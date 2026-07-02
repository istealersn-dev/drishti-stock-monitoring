import { chromium } from "playwright";
import type { Page, Response } from "playwright";
import { z } from "zod";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";
import { buildLoginDialogUrl } from "./loginUrl.js";
import { SELECTORS } from "./selectors.js";
import { generateTotpCode, secondsRemainingInWindow } from "./totp.js";

export const OTP_RATE_LIMIT_CODE = 1017069;

export class LoginFlowError extends Error {
  constructor(
    message: string,
    readonly stage: "mobile" | "totp" | "pin" | "redirect",
    readonly apiErrorCode?: number,
  ) {
    super(message);
    this.name = "LoginFlowError";
  }

  get isOtpRateLimited(): boolean {
    return this.apiErrorCode === OTP_RATE_LIMIT_CODE;
  }
}

const OtpGenerateErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.number(), message: z.string() }),
});

const KNOWN_TOAST_PATTERN = /incorrect [^.]*\.|invalid [^.]*\.|exceeded[^.]*\./i;

// Falls back to a truncated raw-text snippet when the known-wording regex doesn't match,
// so a Slack alert still carries some diagnostic signal if Upstox reworders their copy.
async function readVisibleErrorToast(page: Page): Promise<string | undefined> {
  const toastText = await page
    .locator("body")
    .evaluate((body) => (body as HTMLElement).innerText)
    .catch(() => "");
  if (!toastText) return undefined;
  const match = toastText.match(KNOWN_TOAST_PATTERN);
  if (match) return match[0];
  return `unrecognized page state: ${toastText.slice(0, 200).replace(/\s+/g, " ")}`;
}

const MIN_TOTP_WINDOW_SECONDS = 5;

// Avoids generating a code so close to the end of its 30s window that it expires
// before Upstox validates it — waits out the rollover instead of risking a wasted attempt.
async function freshTotpCode(): Promise<string> {
  const remaining = secondsRemainingInWindow();
  if (remaining < MIN_TOTP_WINDOW_SECONDS) {
    await new Promise((resolve) => setTimeout(resolve, (remaining + 1) * 1000));
  }
  return generateTotpCode();
}

/**
 * Inspects the otp/generate response for Upstox's structured error shape. Throws if the
 * response body was received but is not valid JSON — an unparseable body from an endpoint
 * that has only ever returned JSON in testing is treated as a real failure, not silently
 * ignored, unlike the earlier version of this function.
 */
async function checkOtpGenerateResponse(response: Response): Promise<void> {
  const rawText = await response.text().catch(() => undefined);
  if (rawText === undefined) {
    throw new LoginFlowError("Failed to read otp/generate response body", "mobile");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new LoginFlowError(
      `otp/generate returned a non-JSON response: ${rawText.slice(0, 200)}`,
      "mobile",
    );
  }
  const errorResult = OtpGenerateErrorSchema.safeParse(parsed);
  if (errorResult.success) {
    throw new LoginFlowError(errorResult.data.error.message, "mobile", errorResult.data.error.code);
  }
}

/**
 * Drives the real Upstox login flow (mobile number -> TOTP -> PIN) and returns the
 * OAuth `code` captured from the (intentionally unreachable) redirect_uri request.
 * Always closes the browser, even on failure — never leaves Chromium orphaned.
 */
export async function runLoginFlow(totpCodeOverride?: string): Promise<string> {
  const url = await buildLoginDialogUrl();
  const mobileNumber = await getCredential(CREDENTIAL_KEYS.username);
  const pin = await getCredential(CREDENTIAL_KEYS.pin);
  const redirectUri = await getCredential(CREDENTIAL_KEYS.redirectUri);

  let capturedCode: string | undefined;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on("request", (request) => {
      const requestUrl = request.url();
      if (requestUrl.startsWith(redirectUri)) {
        const code = new URL(requestUrl).searchParams.get("code");
        if (code) capturedCode = code;
      }
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.fill(SELECTORS.mobileNumberInput, mobileNumber);

    // Wait for the actual otp/generate response before proceeding, rather than a fixed
    // timeout racing an unawaited response handler.
    const [otpGenerateResponse] = await Promise.all([
      page
        .waitForResponse((r) => /\/otp\/generate/.test(r.url()), { timeout: 15000 })
        .catch(() => undefined),
      page.click(SELECTORS.getOtpButton),
    ]);
    await page.waitForLoadState("networkidle");

    if (otpGenerateResponse) {
      await checkOtpGenerateResponse(otpGenerateResponse);
    }

    const totpCode = totpCodeOverride ?? (await freshTotpCode());
    await page.fill(SELECTORS.otpTotpInput, totpCode);
    await page.click(SELECTORS.otpContinueButton);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    if (
      !(await page
        .locator(SELECTORS.pinInput)
        .isVisible()
        .catch(() => false))
    ) {
      const toast = await readVisibleErrorToast(page);
      throw new LoginFlowError(toast ?? "TOTP step did not reach the PIN screen", "totp");
    }

    // Wait for the actual redirect request to fire, rather than a fixed timeout that
    // could misreport a merely-slow (but correct) submission as a failure.
    await Promise.all([
      page
        .waitForRequest((r) => r.url().startsWith(redirectUri), { timeout: 15000 })
        .catch(() => undefined),
      (async (): Promise<void> => {
        await page.fill(SELECTORS.pinInput, pin);
        await page.click(SELECTORS.pinContinueButton);
      })(),
    ]);

    if (!capturedCode) {
      const toast = await readVisibleErrorToast(page);
      // A recognized toast means Upstox told us why (e.g. "Incorrect PIN") — a
      // confirmed PIN-entry failure. No toast at all means the cause is unknown
      // (redirect never fired, page structure changed, etc.) and must not be
      // reported as if it were a PIN failure specifically.
      if (toast) {
        throw new LoginFlowError(toast, "pin");
      }
      throw new LoginFlowError(
        "No authorization code captured after PIN submit, and no error toast found",
        "redirect",
      );
    }
    return capturedCode;
  } finally {
    await browser.close();
  }
}

import { chromium } from "playwright";
import type { Page, Response } from "playwright";
import { z } from "zod";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";
import { buildLoginDialogUrl } from "./loginUrl.js";
import { SELECTORS } from "./selectors.js";
import { generateTotpCode, secondsRemainingInWindow } from "./totp.js";

export const OTP_RATE_LIMIT_CODE = 1017069;

const SNIPPET_LENGTH = 200;
const NETWORK_WAIT_TIMEOUT_MS = 10000;

export class LoginFlowError extends Error {
  /**
   * @param message - Human-readable failure description, surfaced in Slack alerts.
   * @param stage - Which step of the login flow failed.
   * @param apiErrorCode - Upstox's structured error code, when one was available (only
   *   the mobile/otp-generate step currently exposes this).
   */
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

// Only the wording confirmed live against the real account. Reworded copy on Upstox's
// side falls through to readPageSnippet instead of matching here.
const KNOWN_TOAST_PATTERN = /incorrect [^.]*\.|invalid [^.]*\.|exceeded[^.]*\./i;

/**
 * Looks for a recognized, known-wording error toast on the page. Returns undefined for
 * any other page content — callers must not treat a truthy return from a generic "page
 * text" read as a confirmed error, or every unrelated bit of page content ends up
 * misreported as a specific failure.
 */
async function matchKnownErrorToast(page: Page): Promise<string | undefined> {
  const toastText = await page
    .locator("body")
    .evaluate((body) => (body as HTMLElement).innerText)
    .catch(() => "");
  const match = toastText.match(KNOWN_TOAST_PATTERN);
  return match?.[0].slice(0, SNIPPET_LENGTH);
}

/** A short, bounded diagnostic snippet of whatever is currently on the page. */
async function readPageSnippet(page: Page): Promise<string> {
  const toastText = await page
    .locator("body")
    .evaluate((body) => (body as HTMLElement).innerText)
    .catch(() => "");
  return toastText.slice(0, SNIPPET_LENGTH).replace(/\s+/g, " ") || "(empty page)";
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
 * Inspects the otp/generate response for Upstox's structured error shape (verified live
 * against the real rate-limit response). Throws if the response body was received but is
 * not valid JSON, or doesn't parse as the known error shape but also isn't silently
 * assumed to be a success — only a genuine schema match short-circuits with an error.
 */
export async function checkOtpGenerateResponse(response: Pick<Response, "text">): Promise<void> {
  const rawText = await response.text().catch(() => undefined);
  if (rawText === undefined) {
    throw new LoginFlowError("Failed to read otp/generate response body", "mobile");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new LoginFlowError(
      `otp/generate returned a non-JSON response: ${rawText.slice(0, SNIPPET_LENGTH)}`,
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
        .waitForResponse((r) => /\/otp\/generate/.test(r.url()), {
          timeout: NETWORK_WAIT_TIMEOUT_MS,
        })
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
      const toast = await matchKnownErrorToast(page);
      const snippet = toast ?? (await readPageSnippet(page));
      throw new LoginFlowError(`TOTP step did not reach the PIN screen: ${snippet}`, "totp");
    }

    // Wait for the actual redirect request to fire, rather than a fixed timeout that
    // could misreport a merely-slow (but correct) submission as a failure.
    await Promise.all([
      page
        .waitForRequest((r) => r.url().startsWith(redirectUri), {
          timeout: NETWORK_WAIT_TIMEOUT_MS,
        })
        .catch(() => undefined),
      (async (): Promise<void> => {
        await page.fill(SELECTORS.pinInput, pin);
        await page.click(SELECTORS.pinContinueButton);
      })(),
    ]);

    if (!capturedCode) {
      // A recognized toast means Upstox told us why (e.g. "Incorrect PIN") — a
      // confirmed PIN-entry failure. Anything else (including ordinary, unrelated page
      // text) means the cause is unknown and must not be reported as a PIN failure.
      const knownToast = await matchKnownErrorToast(page);
      if (knownToast) {
        throw new LoginFlowError(knownToast, "pin");
      }
      const snippet = await readPageSnippet(page);
      throw new LoginFlowError(
        `No authorization code captured after PIN submit: ${snippet}`,
        "redirect",
      );
    }
    return capturedCode;
  } finally {
    await browser.close();
  }
}

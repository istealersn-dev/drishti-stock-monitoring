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
const OTP_GENERATE_WAIT_TIMEOUT_MS = 10000;
const REDIRECT_WAIT_TIMEOUT_MS = 10000;

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

// Only the wording confirmed live against the real account, word-bounded so it can't
// match a substring inside an unrelated word. Reworded copy on Upstox's side falls
// through to the bounded page snippet instead of matching here.
const KNOWN_TOAST_PATTERN = /\bincorrect [^.]*\.|\binvalid [^.]*\.|\bexceeded[^.]*\./i;

type ErrorDiagnostics = {
  /** Set only when a known, previously-observed error toast wording matched. */
  knownToast: string | undefined;
  /** A short, bounded fallback snippet of whatever is on the page, for any other case. */
  snippet: string;
};

/**
 * Reads the page body once and derives both a known-error-toast match and a bounded
 * fallback snippet from that single read, so the two never observe different page
 * states across two separate DOM round-trips.
 * @param page - The current Playwright page.
 * @returns Diagnostics derived from a single body-text read.
 */
async function readErrorDiagnostics(page: Page): Promise<ErrorDiagnostics> {
  const bodyText = await page
    .locator("body")
    .evaluate((body) => (body as HTMLElement).innerText)
    .catch(() => "");
  const match = bodyText.match(KNOWN_TOAST_PATTERN);
  const trimmed = bodyText.trim();
  const snippet = trimmed ? trimmed.slice(0, SNIPPET_LENGTH).replace(/\s+/g, " ") : "(empty page)";
  return { knownToast: match?.[0].slice(0, SNIPPET_LENGTH), snippet };
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
 * @param response - The otp/generate HTTP response.
 * @returns Nothing on success; throws {@link LoginFlowError} on a recognized failure.
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
 * @param totpCodeOverride - Bypasses live TOTP generation with a fixed code; used only
 *   by the failure-path test to deliberately submit a wrong code.
 * @returns The captured OAuth authorization code.
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
          timeout: OTP_GENERATE_WAIT_TIMEOUT_MS,
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
      const { knownToast, snippet } = await readErrorDiagnostics(page);
      throw new LoginFlowError(
        `TOTP step did not reach the PIN screen: ${knownToast ?? snippet}`,
        "totp",
      );
    }

    // Wait for the actual redirect request to fire, rather than a fixed timeout that
    // could misreport a merely-slow (but correct) submission as a failure.
    await Promise.all([
      page
        .waitForRequest((r) => r.url().startsWith(redirectUri), {
          timeout: REDIRECT_WAIT_TIMEOUT_MS,
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
      const { knownToast, snippet } = await readErrorDiagnostics(page);
      if (knownToast) {
        throw new LoginFlowError(knownToast, "pin");
      }
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

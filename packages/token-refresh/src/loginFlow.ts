import { chromium } from "playwright";
import type { Page } from "playwright";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";
import { buildLoginDialogUrl } from "./loginUrl.js";
import { SELECTORS } from "./selectors.js";
import { generateTotpCode, secondsRemainingInWindow } from "./totp.js";

export const OTP_RATE_LIMIT_CODE = 1017069;

export class LoginFlowError extends Error {
  constructor(
    message: string,
    readonly stage: "mobile" | "totp" | "pin",
    readonly apiErrorCode?: number,
  ) {
    super(message);
    this.name = "LoginFlowError";
  }

  get isOtpRateLimited(): boolean {
    return this.apiErrorCode === OTP_RATE_LIMIT_CODE;
  }
}

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
    // timeout racing an unawaited response handler — eliminates the prior timing gap
    // where a slow-to-parse response could be missed entirely.
    const [otpGenerateResponse] = await Promise.all([
      page
        .waitForResponse((r) => /\/otp\/generate/.test(r.url()), { timeout: 15000 })
        .catch(() => undefined),
      page.click(SELECTORS.getOtpButton),
    ]);
    await page.waitForLoadState("networkidle");

    if (otpGenerateResponse) {
      const json = (await otpGenerateResponse.json().catch(() => undefined)) as
        { success?: boolean; error?: { code: number; message: string } } | undefined;
      if (json?.success === false && json.error) {
        throw new LoginFlowError(json.error.message, "mobile", json.error.code);
      }
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

    await page.fill(SELECTORS.pinInput, pin);
    await page.click(SELECTORS.pinContinueButton);
    await page.waitForTimeout(6000);

    if (!capturedCode) {
      const toast = await readVisibleErrorToast(page);
      throw new LoginFlowError(toast ?? "No authorization code captured after PIN submit", "pin");
    }
    return capturedCode;
  } finally {
    await browser.close();
  }
}

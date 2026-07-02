import { chromium } from "playwright";
import type { Page } from "playwright";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";
import { buildLoginDialogUrl } from "./loginUrl.js";
import { SELECTORS } from "./selectors.js";
import { generateTotpCode } from "./totp.js";

export const OTP_RATE_LIMIT_CODE = 1017069;

export class LoginFlowError extends Error {
  constructor(
    message: string,
    readonly stage: "mobile" | "totp" | "pin" | "no-code",
    readonly apiErrorCode?: number,
  ) {
    super(message);
    this.name = "LoginFlowError";
  }

  get isOtpRateLimited(): boolean {
    return this.apiErrorCode === OTP_RATE_LIMIT_CODE;
  }
}

async function readVisibleErrorToast(page: Page): Promise<string | undefined> {
  const toastText = await page
    .locator("body")
    .evaluate((body) => (body as HTMLElement).innerText)
    .catch(() => "");
  const match = toastText.match(/incorrect [^.]*\.|invalid [^.]*\.|exceeded[^.]*\./i);
  return match?.[0];
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
  let otpGenerateError: { code: number; message: string } | undefined;

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
    page.on("response", (response) => {
      if (!/\/otp\/generate/.test(response.url())) return;
      response
        .json()
        .then((json: { success?: boolean; error?: { code: number; message: string } }) => {
          if (json.success === false && json.error) otpGenerateError = json.error;
        })
        .catch(() => {});
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.fill(SELECTORS.mobileNumberInput, mobileNumber);
    await page.click(SELECTORS.getOtpButton);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    if (otpGenerateError) {
      throw new LoginFlowError(otpGenerateError.message, "mobile", otpGenerateError.code);
    }

    const totpCode = totpCodeOverride ?? (await generateTotpCode());
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
      throw new LoginFlowError(
        toast ?? "No authorization code captured after PIN submit",
        "no-code",
      );
    }
    return capturedCode;
  } finally {
    await browser.close();
  }
}

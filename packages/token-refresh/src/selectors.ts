// Single source of truth for every Playwright selector used against the real
// Upstox login flow. Verified against the live DOM, not guessed — update here
// only, and re-verify with a screenshot if Upstox changes their page.
export const SELECTORS = {
  mobileNumberInput: "#mobileNum",
  getOtpButton: "#getOtp",
  otpTotpInput: "#otpNum",
  otpContinueButton: "#continueBtn",
  pinInput: "#pinCode",
  pinContinueButton: "#pinContinueBtn",
} as const;

import { describe, expect, it } from "vitest";

import { LoginFlowError, OTP_RATE_LIMIT_CODE } from "./loginFlow.js";

describe("LoginFlowError", () => {
  it("isOtpRateLimited is true only when the api error code matches Upstox's rate-limit code", () => {
    const rateLimited = new LoginFlowError("exceeded max OTP generations", "mobile", OTP_RATE_LIMIT_CODE);
    expect(rateLimited.isOtpRateLimited).toBe(true);

    const otherError = new LoginFlowError("incorrect PIN", "pin", 1234567);
    expect(otherError.isOtpRateLimited).toBe(false);

    const noCodeAtAll = new LoginFlowError("no code captured", "no-code");
    expect(noCodeAtAll.isOtpRateLimited).toBe(false);
  });

  it("carries the stage it failed at", () => {
    const error = new LoginFlowError("wrong TOTP", "totp");
    expect(error.stage).toBe("totp");
    expect(error.name).toBe("LoginFlowError");
  });
});

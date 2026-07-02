import { describe, expect, it } from "vitest";

import { checkOtpGenerateResponse, LoginFlowError, OTP_RATE_LIMIT_CODE } from "./loginFlow.js";

function textResponse(body: string): { text: () => Promise<string> } {
  return { text: async (): Promise<string> => body };
}

describe("LoginFlowError", () => {
  it("isOtpRateLimited is true only when the api error code matches Upstox's rate-limit code", () => {
    const rateLimited = new LoginFlowError(
      "exceeded max OTP generations",
      "mobile",
      OTP_RATE_LIMIT_CODE,
    );
    expect(rateLimited.isOtpRateLimited).toBe(true);

    const otherError = new LoginFlowError("incorrect PIN", "pin", 1234567);
    expect(otherError.isOtpRateLimited).toBe(false);

    const noRedirect = new LoginFlowError(
      "no code captured after PIN submit, and no error toast found",
      "redirect",
    );
    expect(noRedirect.isOtpRateLimited).toBe(false);
  });

  it("carries the stage it failed at", () => {
    const error = new LoginFlowError("wrong TOTP", "totp");
    expect(error.stage).toBe("totp");
    expect(error.name).toBe("LoginFlowError");
  });

  it("distinguishes a confirmed PIN toast from an unexplained missing redirect", () => {
    const confirmedPinError = new LoginFlowError("Incorrect PIN.", "pin");
    expect(confirmedPinError.stage).toBe("pin");

    const unexplainedError = new LoginFlowError("no code captured, no toast found", "redirect");
    expect(unexplainedError.stage).toBe("redirect");
  });
});

describe("checkOtpGenerateResponse", () => {
  it("throws with the rate-limit code when the response matches the known error shape", async () => {
    const response = textResponse(
      JSON.stringify({
        success: false,
        error: {
          code: OTP_RATE_LIMIT_CODE,
          message: "You have exceeded the maximum number of times you can generate an OTP.",
        },
      }),
    );
    await expect(checkOtpGenerateResponse(response)).rejects.toMatchObject({
      stage: "mobile",
      apiErrorCode: OTP_RATE_LIMIT_CODE,
    });
  });

  it("does not throw when the response is valid JSON but does not match the known error shape (treated as success)", async () => {
    const response = textResponse(JSON.stringify({ success: true }));
    await expect(checkOtpGenerateResponse(response)).resolves.toBeUndefined();
  });

  it("throws instead of silently proceeding when the response body is not valid JSON", async () => {
    const response = textResponse("<html>Bad Gateway</html>");
    await expect(checkOtpGenerateResponse(response)).rejects.toThrow(/non-JSON response/);
  });
});

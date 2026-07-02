import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCredential } = vi.hoisted(() => ({ mockGetCredential: vi.fn() }));

vi.mock("./keychain.js", () => ({ getCredential: mockGetCredential }));

import { exchangeCodeForToken, safeLengthOnly } from "./tokenExchange.js";

describe("safeLengthOnly", () => {
  it("never includes any characters from the original value", () => {
    const masked = safeLengthOnly("abcdef");
    expect(masked).not.toContain("abcdef");
    expect(masked).not.toContain("abc");
    expect(masked).not.toContain("def");
  });

  it("reports the correct length", () => {
    expect(safeLengthOnly("123456")).toContain("length=6");
    expect(safeLengthOnly("a".repeat(311))).toContain("length=311");
  });
});

describe("exchangeCodeForToken", () => {
  beforeEach(() => {
    mockGetCredential.mockReset();
    mockGetCredential.mockResolvedValue("cred-value");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns success with the access token on a valid response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "token-value" }),
    });
    const result = await exchangeCodeForToken("auth-code");
    expect(result).toEqual({ success: true, accessToken: "token-value" });
  });

  it("returns failure with the API message when the exchange is rejected", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "invalid code" }),
    });
    const result = await exchangeCodeForToken("bad-code");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("400");
      expect(result.errorMessage).toContain("invalid code");
    }
  });

  it("treats a 200 response with no access_token as a failure, not a crash", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: "shape" }),
    });
    const result = await exchangeCodeForToken("auth-code");
    expect(result.success).toBe(false);
  });
});

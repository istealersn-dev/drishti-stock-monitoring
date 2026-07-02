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

function mockFetchResponse(options: { ok: boolean; status: number; body: unknown }): {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
} {
  return {
    ok: options.ok,
    status: options.status,
    text: async (): Promise<string> => JSON.stringify(options.body),
  };
}

describe("exchangeCodeForToken", () => {
  beforeEach(() => {
    mockGetCredential.mockReset();
    mockGetCredential.mockResolvedValue("cred-value");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns success with the access token on a valid response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ok: true, status: 200, body: { access_token: "token-value" } }),
    );
    const result = await exchangeCodeForToken("auth-code");
    expect(result).toEqual({ success: true, accessToken: "token-value" });
  });

  it("returns failure with the API message when the exchange is rejected", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ok: false, status: 400, body: { message: "invalid code" } }),
    );
    const result = await exchangeCodeForToken("bad-code");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("400");
      expect(result.errorMessage).toContain("invalid code");
    }
  });

  it("treats a 200 response with no access_token as a failure, not a crash", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ok: true, status: 200, body: { unexpected: "shape" } }),
    );
    const result = await exchangeCodeForToken("auth-code");
    expect(result.success).toBe(false);
  });

  it("treats an empty access_token string as a failure, not a success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ok: true, status: 200, body: { access_token: "" } }),
    );
    const result = await exchangeCodeForToken("auth-code");
    expect(result.success).toBe(false);
  });

  it("passes an abort signal to fetch so a hung connection cannot block forever", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ ok: true, status: 200, body: { access_token: "token-value" } }),
    );
    await exchangeCodeForToken("auth-code");
    const callOptions = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      signal?: AbortSignal;
    };
    expect(callOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it("treats a non-JSON response body as a failure, not a thrown exception", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "<html>Bad Gateway</html>",
    });
    const result = await exchangeCodeForToken("auth-code");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("502");
    }
  });
});

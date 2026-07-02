import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCredential } = vi.hoisted(() => ({ mockGetCredential: vi.fn() }));

vi.mock("./keychain.js", () => ({ getCredential: mockGetCredential }));

import { generateTotpCode, secondsRemainingInWindow } from "./totp.js";

describe("totp", () => {
  beforeEach(() => {
    mockGetCredential.mockReset();
  });

  it("generates a 6-digit code from the stored base32 secret", async () => {
    // A well-known test secret (RFC 6238 style base32), not a real account secret.
    mockGetCredential.mockResolvedValue("JBSWY3DPEHPK3PXP");
    const code = await generateTotpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("is deterministic for the same secret and moment in time", async () => {
    mockGetCredential.mockResolvedValue("JBSWY3DPEHPK3PXP");
    const first = await generateTotpCode();
    const second = await generateTotpCode();
    expect(first).toBe(second);
  });

  it("secondsRemainingInWindow stays within the 30s period bounds", () => {
    const remaining = secondsRemainingInWindow();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });
});

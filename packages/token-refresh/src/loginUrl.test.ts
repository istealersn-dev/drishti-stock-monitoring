import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCredential } = vi.hoisted(() => ({ mockGetCredential: vi.fn() }));

vi.mock("./keychain.js", () => ({ getCredential: mockGetCredential }));

import { buildLoginDialogUrl } from "./loginUrl.js";

describe("buildLoginDialogUrl", () => {
  beforeEach(() => {
    mockGetCredential.mockReset();
    mockGetCredential.mockImplementation(async (key: string) => {
      if (key.includes("api-key")) return "test-api-key";
      if (key.includes("redirect-uri")) return "http://localhost:6318/callback";
      throw new Error(`unexpected key: ${key}`);
    });
  });

  it("builds a URL against Upstox's real authorization dialog endpoint", async () => {
    const url = await buildLoginDialogUrl();
    expect(url.startsWith("https://api.upstox.com/v2/login/authorization/dialog?")).toBe(true);
  });

  it("includes response_type=code, client_id, and redirect_uri", async () => {
    const url = new URL(await buildLoginDialogUrl());
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-api-key");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:6318/callback");
  });
});

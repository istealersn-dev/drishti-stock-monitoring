import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbGet } = vi.hoisted(() => ({ mockDbGet: vi.fn() }));

vi.mock("../db/db.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: mockDbGet }),
      }),
    }),
  },
}));
vi.mock("../db/schema.js", () => ({ agentSettings: {} }));

describe("isDryRunActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns true when the DB override is 'true', even if env is false", async () => {
    vi.doMock("./env.js", () => ({ env: { DRISHTI_DRY_RUN: false } }));
    mockDbGet.mockReturnValue({ key: "dry_run", value: "true" });

    const { isDryRunActive } = await import("./dryRun.js");
    expect(isDryRunActive()).toBe(true);
  });

  it("returns false when the DB override is 'false', even if env is true", async () => {
    vi.doMock("./env.js", () => ({ env: { DRISHTI_DRY_RUN: true } }));
    mockDbGet.mockReturnValue({ key: "dry_run", value: "false" });

    const { isDryRunActive } = await import("./dryRun.js");
    expect(isDryRunActive()).toBe(false);
  });

  it("falls back to env when no DB row exists", async () => {
    vi.doMock("./env.js", () => ({ env: { DRISHTI_DRY_RUN: true } }));
    mockDbGet.mockReturnValue(undefined);

    const { isDryRunActive } = await import("./dryRun.js");
    expect(isDryRunActive()).toBe(true);
  });
});

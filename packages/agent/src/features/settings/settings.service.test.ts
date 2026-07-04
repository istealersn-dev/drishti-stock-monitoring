import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({
  db: { select: mockDbSelect },
}));

vi.mock("../../db/schema.js", () => ({
  agentSettings: { key: "key", value: "value" },
}));

import { isAgentPaused, isBooleanSettingEnabled } from "./settings.service.js";

function mockSettingsRow(row: { value: string } | undefined): void {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(row) }),
    }),
  });
}

describe("isAgentPaused", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the pause_agent setting is "true"', () => {
    mockSettingsRow({ value: "true" });
    expect(isAgentPaused()).toBe(true);
  });

  it('returns false when the pause_agent setting is "false"', () => {
    mockSettingsRow({ value: "false" });
    expect(isAgentPaused()).toBe(false);
  });

  it("defaults to false (not paused) when no DB row exists", () => {
    mockSettingsRow(undefined);
    expect(isAgentPaused()).toBe(false);
  });
});

describe("isBooleanSettingEnabled", () => {
  it('returns true only for the exact string "true"', () => {
    expect(isBooleanSettingEnabled("true")).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(isBooleanSettingEnabled("false")).toBe(false);
  });

  it("returns false for undefined (no DB row)", () => {
    expect(isBooleanSettingEnabled(undefined)).toBe(false);
  });

  it('returns false for values that aren\'t the exact string "true"', () => {
    expect(isBooleanSettingEnabled("1")).toBe(false);
  });
});

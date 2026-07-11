import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockDbSelect, mockDbTransaction, mockDbSelectAll } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockDbSelectAll: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({
  db: { select: mockDbSelect, transaction: mockDbTransaction },
}));

vi.mock("../../db/schema.js", () => ({
  agentSettings: { key: "key", value: "value" },
  brokerConnections: { brokerId: "broker_id" },
}));

import {
  getActiveBrokerId,
  getBrokerConnections,
  isAgentPaused,
  isBooleanSettingEnabled,
  setActiveBroker,
} from "./settings.service.js";

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

describe("getActiveBrokerId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored broker id when it's a known BrokerId", () => {
    mockSettingsRow({ value: "groww" });
    expect(getActiveBrokerId()).toBe("groww");
  });

  it("defaults to upstox when no DB row exists", () => {
    mockSettingsRow(undefined);
    expect(getActiveBrokerId()).toBe("upstox");
  });

  it("defaults to upstox when the stored value isn't a known BrokerId", () => {
    mockSettingsRow({ value: "not-a-real-broker" });
    expect(getActiveBrokerId()).toBe("upstox");
  });
});

describe("setActiveBroker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the active_broker_id setting and flips broker_connections rows inside one transaction", () => {
    const runCalls: string[] = [];
    type TxMock = { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    const tx: TxMock = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            run: vi.fn().mockImplementation(() => runCalls.push("insert")),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          run: vi.fn().mockImplementation(() => runCalls.push("update")),
        }),
      }),
    };
    mockDbTransaction.mockImplementation((fn: (tx: TxMock) => void) => fn(tx));

    setActiveBroker("groww");

    expect(mockDbTransaction).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(runCalls).toEqual(["insert", "update", "insert"]);
  });
});

describe("getBrokerConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ all: mockDbSelectAll }) });
  });

  it("returns every broker_connections row", () => {
    const rows = [{ brokerId: "upstox", isActive: true, status: "connected" }];
    mockDbSelectAll.mockReturnValue(rows);
    expect(getBrokerConnections()).toEqual(rows);
  });

  it("returns an empty array when no broker has ever been activated", () => {
    mockDbSelectAll.mockReturnValue([]);
    expect(getBrokerConnections()).toEqual([]);
  });
});

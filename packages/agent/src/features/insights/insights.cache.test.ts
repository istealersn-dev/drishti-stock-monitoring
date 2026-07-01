import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockDbInsert, mockDbSelect } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({
  db: { insert: mockDbInsert, select: mockDbSelect },
}));

vi.mock("../../db/schema.js", () => ({
  agentSettings: { key: "key", value: "value" },
}));

import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

import {
  __resetAnalysisSnapshotForTests,
  hasMovedSignificantly,
  recordAnalysisSnapshot,
} from "./insights.cache.js";

const mockHolding: Holding = {
  isin: "INE001",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank",
  quantity: 10,
  average_price: 1000,
  last_price: 1000,
  close_price: 1000,
  pnl: 0,
  day_change: 0,
  day_change_percentage: 0,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
};

function ltpMapFor(price: number): Record<string, LtpData> {
  return {
    [mockHolding.instrument_token]: {
      last_price: price,
      instrument_token: mockHolding.instrument_token,
    },
  };
}

describe("insights.cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAnalysisSnapshotForTests();
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
      }),
    });
  });

  it("treats a holding with no prior snapshot as moved", () => {
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(1000), 4)).toBe(true);
  });

  it("does not flag a move below the threshold", () => {
    recordAnalysisSnapshot([mockHolding], ltpMapFor(1000));
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(1030), 4)).toBe(false);
  });

  it("flags a move at or above the threshold", () => {
    recordAnalysisSnapshot([mockHolding], ltpMapFor(1000));
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(1040), 4)).toBe(true);
  });

  it("flags a significant downward move", () => {
    recordAnalysisSnapshot([mockHolding], ltpMapFor(1000));
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(950), 4)).toBe(true);
  });

  it("persists the snapshot to agent_settings so it survives a process restart", () => {
    const runSpy = vi.fn();
    const onConflictDoUpdate = vi.fn().mockReturnValue({ run: runSpy });
    mockDbInsert.mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoUpdate }) });

    recordAnalysisSnapshot([mockHolding], ltpMapFor(1000));

    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
    expect(runSpy).toHaveBeenCalledOnce();
  });

  it("reloads the snapshot from agent_settings after a simulated restart (cache reset)", () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ value: JSON.stringify({ "AXISBANK-EQ": 1000 }) }),
        }),
      }),
    });

    // Simulates a fresh process: no recordAnalysisSnapshot call yet this run,
    // but a prior run's snapshot is on disk and should be loaded on first read.
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(1030), 4)).toBe(false);
    expect(hasMovedSignificantly([mockHolding], ltpMapFor(1050), 4)).toBe(true);
  });
});

import { describe, it, expect, beforeEach } from "vitest";

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
    __resetAnalysisSnapshotForTests();
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
});

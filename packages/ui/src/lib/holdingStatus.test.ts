import { describe, expect, it } from "vitest";

import type { GttOrder, Holding, HoldingConfig } from "./api";
import { buildSlMap, buildTargetMap, resolveHoldingStatus } from "./holdingStatus";

const holding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE000",
  trading_symbol: "INFY",
  company_name: "Infosys",
  quantity: 10,
  average_price: 100,
  last_price: 100,
  close_price: 100,
  pnl: 0,
  day_change: 0,
  day_change_percentage: 0,
  product: "D",
  exchange: "NSE",
  instrument_token: "1",
  ...overrides,
});

const order = (overrides: Partial<GttOrder> = {}): GttOrder => ({
  id: "1",
  symbol: "INFY",
  type: "sl_exit",
  triggerPrice: 90,
  limitPrice: 89,
  quantity: 10,
  status: "active",
  approvalId: null,
  createdAt: "2026-11-02T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
  ...overrides,
});

describe("resolveHoldingStatus", () => {
  const slMap = new Map([["INFY", 100]]);

  it("flags a price at or below the stop-loss as a breach", () => {
    expect(resolveHoldingStatus(holding({ last_price: 100 }), slMap).label).toBe("Breach");
  });

  it("flags a price within 5% of the stop-loss as watch", () => {
    expect(resolveHoldingStatus(holding({ last_price: 104.9 }), slMap).label).toBe("Watch");
  });

  it("treats a price beyond the 5% band as safe", () => {
    expect(resolveHoldingStatus(holding({ last_price: 106 }), slMap).label).toBe("Safe");
  });

  it("says No SL rather than Safe when there's nothing to judge by", () => {
    expect(resolveHoldingStatus(holding(), new Map()).label).toBe("No SL");
  });

  it("treats a closed-out holding as safe even below its stop-loss", () => {
    expect(resolveHoldingStatus(holding({ quantity: 0, last_price: 1 }), slMap).label).toBe("Safe");
  });
});

const config = (overrides: Partial<HoldingConfig> = {}): HoldingConfig => ({
  symbol: "INFY",
  slThreshold: 90,
  targetOne: null,
  targetTwo: null,
  targetTwoOpen: false,
  ...overrides,
});

describe("buildSlMap", () => {
  it("indexes sl_exit orders only", () => {
    const map = buildSlMap([order(), order({ symbol: "TCS", type: "buy_entry" })], []);
    expect([...map.keys()]).toEqual(["INFY"]);
  });

  it("ignores a malformed zero trigger", () => {
    expect(buildSlMap([order({ triggerPrice: 0 })], []).size).toBe(0);
  });

  it("uses the stock_config threshold for a holding with no GTT", () => {
    expect(buildSlMap([], [config()]).get("INFY")).toBe(90);
  });

  it("prefers stock_config over a GTT, since that's what the agent checks", () => {
    expect(buildSlMap([order()], [config()]).get("INFY")).toBe(90);
  });

  it("reads a zero threshold as no stop-loss", () => {
    expect(buildSlMap([], [config({ slThreshold: 0 })]).size).toBe(0);
  });

  it("keeps a GTT's trigger for a holding with no config", () => {
    expect(buildSlMap([order()], [config({ symbol: "TCS" })]).has("INFY")).toBe(true);
  });
});

describe("buildTargetMap", () => {
  it("indexes first targets and skips holdings without one", () => {
    const map = buildTargetMap([
      config({ targetOne: 120 }),
      config({ symbol: "TCS", targetOne: null }),
    ]);
    expect([...map]).toEqual([["INFY", 120]]);
  });
});

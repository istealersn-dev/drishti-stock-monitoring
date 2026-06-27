import { describe, it, expect, vi } from "vitest";

import type { Holding } from "./portfolio.schema.js";
import { buildPortfolioSummary, formatPortfolioSummary } from "./portfolio.service.js";

vi.mock("../../shared/env.js", () => ({
  env: {
    UPSTOX_EXTENDED_TOKEN: "test-token",
    UPSTOX_ACCESS_TOKEN: undefined,
  },
}));

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE002A01018",
  trading_symbol: "RELIANCE",
  company_name: "Reliance Industries Ltd",
  quantity: 10,
  average_price: 2800,
  last_price: 2900,
  close_price: 2880,
  pnl: 1000,
  day_change: 20,
  day_change_percentage: 0.69,
  instrument_token: "NSE_EQ|INE002A01018",
  exchange: "NSE",
  product: "CNC",
  ...overrides,
});

describe("buildPortfolioSummary", () => {
  it("computes totals from holdings", () => {
    const holdings = [
      makeHolding({ quantity: 10, average_price: 1000, last_price: 1100 }),
      makeHolding({ trading_symbol: "TCS", quantity: 5, average_price: 3000, last_price: 3200 }),
    ];
    const summary = buildPortfolioSummary(holdings);
    expect(summary.holdingCount).toBe(2);
    expect(summary.totalCost).toBe(10 * 1000 + 5 * 3000);
    expect(summary.totalValue).toBe(10 * 1100 + 5 * 3200);
    expect(summary.totalPnl).toBe(summary.totalValue - summary.totalCost);
  });

  it("handles empty holdings", () => {
    const summary = buildPortfolioSummary([]);
    expect(summary.holdingCount).toBe(0);
    expect(summary.totalPnlPercent).toBe(0);
  });
});

describe("formatPortfolioSummary", () => {
  it("includes all key fields in output", () => {
    const summary = buildPortfolioSummary([makeHolding()]);
    const text = formatPortfolioSummary(summary);
    expect(text).toContain("Portfolio Snapshot");
    expect(text).toContain("Holdings:");
    expect(text).toContain("Total value:");
    expect(text).toContain("P&L:");
  });

  it("uses + prefix for positive P&L", () => {
    const summary = buildPortfolioSummary([makeHolding({ average_price: 100, last_price: 200 })]);
    const text = formatPortfolioSummary(summary);
    expect(text).toContain("+₹");
  });
});

import { describe, expect, it } from "vitest";

import type { Holding } from "./api";
import { distanceToSlPercentage, percentOfCost, pnlPercentage } from "./holdingFormat";

const row = (overrides: Partial<Holding> = {}): Holding => ({
  quantity: 10,
  average_price: 100,
  last_price: 110,
  pnl: 100,
  isin: "",
  trading_symbol: "",
  company_name: "",
  close_price: 0,
  day_change: 0,
  day_change_percentage: 0,
  product: "",
  exchange: "",
  instrument_token: "",
  ...overrides,
});

describe("percentOfCost", () => {
  it("guards a zero cost", () => {
    expect(percentOfCost(100, 0)).toBe(0);
  });
});

describe("pnlPercentage", () => {
  it("is P&L over quantity times average price", () => {
    expect(pnlPercentage(row())).toBe(10);
  });
});

describe("distanceToSlPercentage", () => {
  it("is the LTP's distance above the stop-loss", () => {
    expect(distanceToSlPercentage(row({ last_price: 105 }), 100)).toBe(5);
  });

  it("goes negative past the stop-loss", () => {
    expect(distanceToSlPercentage(row({ last_price: 90 }), 100)).toBe(-10);
  });

  it("is undefined with no usable stop-loss", () => {
    expect(distanceToSlPercentage(row(), undefined)).toBeUndefined();
    expect(distanceToSlPercentage(row(), 0)).toBeUndefined();
  });
});

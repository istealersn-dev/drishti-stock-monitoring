import { describe, it, expect } from "vitest";

import type { Holding } from "../../broker/brokerClient.types.js";

import {
  buildMorningDigest,
  buildClosingDigest,
  calculateMtfBurnRate,
  estimateUncoveredCount,
} from "./digest.builder.js";
import type { DigestInput } from "./digest.builder.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE001",
  tradingSymbol: "AXISBANK-EQ",
  companyName: "Axis Bank",
  quantity: 10,
  averagePrice: 1000,
  lastPrice: 1100,
  closePrice: 1090,
  pnl: 1000,
  dayChange: 10,
  dayChangePercentage: 0.9,
  instrumentToken: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

const baseInput = (): DigestInput => ({
  holdings: [makeHolding()],
  activeGttCount: 1,
  pendingApprovalCount: 0,
  todayBreachCount: 0,
  todayTargetHitCount: 0,
  todayDecisionCount: 3,
  type: "morning",
});

describe("calculateMtfBurnRate", () => {
  it("returns 0 when no MTF holdings", () => {
    const holdings = [makeHolding({ product: "D" })];
    expect(calculateMtfBurnRate(holdings)).toBe(0);
  });

  it("calculates daily burn for MTF holdings", () => {
    const holdings = [makeHolding({ product: "MTF", quantity: 10, averagePrice: 1000 })];
    const expected = Number(((10_000 * 0.18) / 365).toFixed(2));
    expect(calculateMtfBurnRate(holdings)).toBe(expected);
  });

  it("sums burn across multiple MTF holdings", () => {
    const holdings = [
      makeHolding({ product: "MTF", quantity: 10, averagePrice: 1000 }),
      makeHolding({
        product: "MTF",
        quantity: 5,
        averagePrice: 2000,
        tradingSymbol: "HDFCBANK-EQ",
      }),
    ];
    const expected = Number((((10_000 + 10_000) * 0.18) / 365).toFixed(2));
    expect(calculateMtfBurnRate(holdings)).toBe(expected);
  });
});

describe("estimateUncoveredCount", () => {
  it("returns 0 when all holdings have GTTs", () => {
    const holdings = [makeHolding(), makeHolding()];
    expect(estimateUncoveredCount(holdings, 2)).toBe(0);
  });

  it("returns count of uncovered holdings", () => {
    const holdings = [makeHolding(), makeHolding(), makeHolding()];
    expect(estimateUncoveredCount(holdings, 1)).toBe(2);
  });

  it("never returns negative", () => {
    const holdings = [makeHolding()];
    expect(estimateUncoveredCount(holdings, 5)).toBe(0);
  });
});

describe("buildMorningDigest", () => {
  it("contains the Morning Briefing header", () => {
    const result = buildMorningDigest(baseInput());
    expect(result).toContain("Morning Briefing");
  });

  it("includes holding count", () => {
    const result = buildMorningDigest(baseInput());
    expect(result).toContain("1 holding");
  });

  it("shows MTF burn rate when MTF holdings present", () => {
    const input = {
      ...baseInput(),
      holdings: [makeHolding({ product: "MTF", quantity: 100, averagePrice: 500 })],
    };
    const result = buildMorningDigest(input);
    expect(result).toContain("burn rate");
  });

  it("shows pending approval warning when count > 0", () => {
    const input = { ...baseInput(), pendingApprovalCount: 2 };
    const result = buildMorningDigest(input);
    expect(result).toContain("Pending approvals");
  });

  it("shows SL coverage gap when uncovered holdings exist", () => {
    const input = { ...baseInput(), activeGttCount: 0 };
    const result = buildMorningDigest(input);
    expect(result).toContain("Coverage gap");
  });
});

describe("buildClosingDigest", () => {
  it("contains the Closing Summary header", () => {
    const result = buildClosingDigest(baseInput());
    expect(result).toContain("Closing Summary");
  });

  it("includes today breach and target hit counts", () => {
    const input = { ...baseInput(), todayBreachCount: 2, todayTargetHitCount: 1 };
    const result = buildClosingDigest(input);
    expect(result).toContain("Breaches today* — 2");
    expect(result).toContain("hits today* — 1");
  });

  it("ends with market closed message", () => {
    const result = buildClosingDigest(baseInput());
    expect(result).toContain("Market closed");
  });
});

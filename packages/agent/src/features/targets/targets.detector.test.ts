import { describe, it, expect } from "vitest";

import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

import { detectTargetHits } from "./targets.detector.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE001",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank",
  quantity: 10,
  average_price: 1000,
  last_price: 1100,
  close_price: 1090,
  pnl: 1000,
  day_change: 10,
  day_change_percentage: 0.9,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

describe("detectTargetHits", () => {
  const ltp = (price: number): LtpData => ({
    last_price: price,
    instrument_token: "NSE_EQ|INE238A01034",
  });

  it("returns empty when no configs exist", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(1100) }, []);
    expect(result).toHaveLength(0);
  });

  it("returns empty when LTP is below both targets", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(800) }, [
      { symbol: "AXISBANK-EQ", targetOne: 1000, targetTwo: 1200 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("detects T1 hit when LTP equals targetOne", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(1000) }, [
      { symbol: "AXISBANK-EQ", targetOne: 1000, targetTwo: 1200 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.targetLevel).toBe(1);
    expect(result[0]?.targetPrice).toBe(1000);
  });

  it("detects T2 hit when LTP exceeds targetTwo", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(1250) }, [
      { symbol: "AXISBANK-EQ", targetOne: 1000, targetTwo: 1200 },
    ]);
    const levels = result.map((h) => h.targetLevel);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
  });

  it("skips holding when no LTP is available for its token", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], {}, [
      { symbol: "AXISBANK-EQ", targetOne: 1000, targetTwo: 1200 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("skips target when targetOne is null", () => {
    const holding = makeHolding();
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(1300) }, [
      { symbol: "AXISBANK-EQ", targetOne: null, targetTwo: 1200 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.targetLevel).toBe(2);
  });

  it("returns correct companyName and currentPrice on hit", () => {
    const holding = makeHolding({ company_name: "Axis Bank Ltd" });
    const result = detectTargetHits([holding], { "NSE_EQ|INE238A01034": ltp(1050) }, [
      { symbol: "AXISBANK-EQ", targetOne: 1000, targetTwo: null },
    ]);
    expect(result[0]?.companyName).toBe("Axis Bank Ltd");
    expect(result[0]?.currentPrice).toBe(1050);
  });
});

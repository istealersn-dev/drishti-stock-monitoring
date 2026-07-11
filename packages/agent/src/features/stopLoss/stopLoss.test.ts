import { describe, it, expect } from "vitest";

import type { Holding, Quote } from "../../broker/brokerClient.types.js";

import type { StockSlConfig } from "./stopLoss.config.js";
import { detectBreaches } from "./stopLoss.detector.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE238A01034",
  tradingSymbol: "AXISBANK-EQ",
  companyName: "Axis Bank Ltd",
  quantity: 50,
  averagePrice: 1000,
  lastPrice: 950,
  closePrice: 960,
  pnl: -2500,
  dayChange: -50,
  dayChangePercentage: -5.0,
  instrumentToken: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

const makeLtpEntry = (lastPrice: number): Quote => ({
  lastPrice,
  instrumentToken: "NSE_EQ|INE238A01034",
});

const makeConfig = (overrides: Partial<StockSlConfig> = {}): StockSlConfig => ({
  symbol: "AXISBANK-EQ",
  slThreshold: 900,
  ...overrides,
});

describe("detectBreaches", () => {
  it("detects a breach when LTP is below SL threshold", () => {
    const holdings = [makeHolding()];
    const ltpMap = { "NSE_EQ|INE238A01034": makeLtpEntry(880) };
    const configs = [makeConfig()];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(1);
    expect(breaches[0]?.holding.tradingSymbol).toBe("AXISBANK-EQ");
    expect(breaches[0]?.lastTradedPrice).toBe(880);
    expect(breaches[0]?.slThreshold).toBe(900);
  });

  it("detects a breach when LTP equals the SL threshold exactly", () => {
    const holdings = [makeHolding()];
    const ltpMap = { "NSE_EQ|INE238A01034": makeLtpEntry(900) };
    const configs = [makeConfig({ slThreshold: 900 })];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(1);
  });

  it("returns no breaches when LTP is above SL threshold", () => {
    const holdings = [makeHolding()];
    const ltpMap = { "NSE_EQ|INE238A01034": makeLtpEntry(950) };
    const configs = [makeConfig({ slThreshold: 900 })];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(0);
  });

  it("skips holdings without an SL config", () => {
    const holdings = [makeHolding({ tradingSymbol: "RELIANCE-EQ" })];
    const ltpMap = { "NSE_EQ|INE238A01034": makeLtpEntry(800) };
    const configs: StockSlConfig[] = [];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(0);
  });

  it("skips holdings without LTP data", () => {
    const holdings = [makeHolding()];
    const ltpMap: Record<string, Quote> = {};
    const configs = [makeConfig()];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(0);
  });

  it("detects multiple breaches across holdings", () => {
    const holdings = [
      makeHolding({ tradingSymbol: "AXISBANK-EQ", instrumentToken: "NSE_EQ|A" }),
      makeHolding({ tradingSymbol: "RELIANCE-EQ", instrumentToken: "NSE_EQ|B" }),
    ];
    const ltpMap = {
      "NSE_EQ|A": { lastPrice: 850, instrumentToken: "NSE_EQ|A" },
      "NSE_EQ|B": { lastPrice: 2700, instrumentToken: "NSE_EQ|B" },
    };
    const configs = [
      makeConfig({ symbol: "AXISBANK-EQ", slThreshold: 900 }),
      makeConfig({ symbol: "RELIANCE-EQ", slThreshold: 2800 }),
    ];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(2);
  });

  it("returns empty array for empty inputs", () => {
    expect(detectBreaches([], {}, [])).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";

import type { Holding } from "../portfolio/portfolio.schema.js";
import type { LtpData } from "../portfolio/portfolio.schema.js";

import type { StockSlConfig } from "./stopLoss.config.js";
import { detectBreaches } from "./stopLoss.detector.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE238A01034",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank Ltd",
  quantity: 50,
  average_price: 1000,
  last_price: 950,
  close_price: 960,
  pnl: -2500,
  day_change: -50,
  day_change_percentage: -5.0,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

const makeLtpEntry = (lastPrice: number): LtpData => ({
  last_price: lastPrice,
  instrument_token: "NSE_EQ|INE238A01034",
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
    expect(breaches[0]?.holding.trading_symbol).toBe("AXISBANK-EQ");
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
    const holdings = [makeHolding({ trading_symbol: "RELIANCE-EQ" })];
    const ltpMap = { "NSE_EQ|INE238A01034": makeLtpEntry(800) };
    const configs: StockSlConfig[] = [];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(0);
  });

  it("skips holdings without LTP data", () => {
    const holdings = [makeHolding()];
    const ltpMap: Record<string, LtpData> = {};
    const configs = [makeConfig()];

    const breaches = detectBreaches(holdings, ltpMap, configs);

    expect(breaches).toHaveLength(0);
  });

  it("detects multiple breaches across holdings", () => {
    const holdings = [
      makeHolding({ trading_symbol: "AXISBANK-EQ", instrument_token: "NSE_EQ|A" }),
      makeHolding({ trading_symbol: "RELIANCE-EQ", instrument_token: "NSE_EQ|B" }),
    ];
    const ltpMap = {
      "NSE_EQ|A": { last_price: 850, instrument_token: "NSE_EQ|A" },
      "NSE_EQ|B": { last_price: 2700, instrument_token: "NSE_EQ|B" },
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

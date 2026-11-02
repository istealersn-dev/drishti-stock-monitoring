import { describe, expect, it } from "vitest";

import type { Holding } from "./api";
import { rankPositions } from "./rankPositions";

const holding = (symbol: string, lastPrice: number, pnl = 0): Holding => ({
  isin: symbol,
  trading_symbol: symbol,
  company_name: symbol,
  quantity: 10,
  average_price: 100,
  last_price: lastPrice,
  close_price: lastPrice,
  pnl,
  day_change: 0,
  day_change_percentage: 0,
  product: "D",
  exchange: "NSE",
  instrument_token: symbol,
});

const symbols = (
  holdings: Holding[],
  slMap: Map<string, number>,
  sort: "none" | "desc" | "asc",
): string[] => rankPositions(holdings, slMap, sort).rows.map((row) => row.holding.trading_symbol);

describe("rankPositions", () => {
  const sl = (...entries: [string, number][]): Map<string, number> => new Map(entries);

  it("leads with breaches, then watch, then no GTT, then safe", () => {
    const holdings = [
      holding("SAFE", 200),
      holding("NONE", 200),
      holding("WATCH", 102),
      holding("BREACH", 90),
    ];
    const slMap = sl(["SAFE", 100], ["WATCH", 100], ["BREACH", 100]);
    expect(symbols(holdings, slMap, "none")).toEqual(["BREACH", "WATCH", "NONE", "SAFE"]);
  });

  it("orders each risk level by distance to the stop-loss", () => {
    const holdings = [holding("FAR", 104), holding("NEAR", 101)];
    expect(symbols(holdings, sl(["FAR", 100], ["NEAR", 100]), "none")).toEqual(["NEAR", "FAR"]);
  });

  it("sorts P&L within a risk level, never across one", () => {
    const holdings = [
      holding("BREACH", 90, -500),
      holding("LOW", 200, 10),
      holding("HIGH", 200, 90),
    ];
    const slMap = sl(["BREACH", 100], ["LOW", 100], ["HIGH", 100]);
    expect(symbols(holdings, slMap, "desc")).toEqual(["BREACH", "HIGH", "LOW"]);
    expect(symbols(holdings, slMap, "asc")).toEqual(["BREACH", "LOW", "HIGH"]);
  });

  it("caps safe rows at five", () => {
    const holdings = Array.from({ length: 8 }, (_, index) => holding(`S${index}`, 200));
    const slMap = sl(...holdings.map((h): [string, number] => [h.trading_symbol, 100]));
    expect(rankPositions(holdings, slMap, "none").rows).toHaveLength(5);
  });

  it("never cuts an at-risk or no-GTT row", () => {
    const breaches = Array.from({ length: 4 }, (_, index) => holding(`B${index}`, 90));
    const noGtt = Array.from({ length: 3 }, (_, index) => holding(`N${index}`, 200));
    const slMap = sl(...breaches.map((h): [string, number] => [h.trading_symbol, 100]));
    const ranking = rankPositions([...breaches, ...noGtt], slMap, "none");
    expect(ranking.rows).toHaveLength(7);
    expect(ranking.atRiskCount).toBe(4);
    expect(ranking.noGttCount).toBe(3);
  });
});

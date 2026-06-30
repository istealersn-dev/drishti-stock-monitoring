import { describe, it, expect, vi, beforeEach } from "vitest";

import { ok, err, UpstoxError } from "../../shared/errors.js";
import type { ParsedInstruction } from "../instructions/instructions.schema.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

import { validateConcentration } from "./validator.concentration.js";
import { validateRiskReward } from "./validator.rr.js";

const fetchHoldings = vi.fn();

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: (): unknown => fetchHoldings(),
}));

const makeInstruction = (overrides: Partial<ParsedInstruction> = {}): ParsedInstruction => ({
  stockName: "Ramco Systems",
  action: "BUY",
  entryLow: 560,
  entryHigh: 580,
  stopLoss: 520,
  targets: [{ price: 680, isOpenEnded: false }],
  ...overrides,
});

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE002A01018",
  trading_symbol: "RELIANCE",
  company_name: "Reliance Industries Ltd",
  quantity: 1000,
  average_price: 950,
  last_price: 1000,
  close_price: 990,
  pnl: 50000,
  day_change: 10,
  day_change_percentage: 1,
  instrument_token: "NSE_EQ|INE002A01018",
  exchange: "NSE",
  product: "CNC",
  ...overrides,
});

describe("validateRiskReward", () => {
  it("passes when R:R meets the 1:2 minimum", () => {
    const result = validateRiskReward(makeInstruction());
    expect(result.pass).toBe(true);
  });

  it("fails with the correct message when R:R is 1:1", () => {
    const result = validateRiskReward(
      makeInstruction({ targets: [{ price: 620, isOpenEnded: false }] }),
    );
    expect(result).toEqual({
      pass: false,
      reason: "R:R is 1:1.0 — minimum required is 1:2. Raise T1 to at least ₹670 or tighten SL.",
    });
  });

  it("fails when stop-loss is above entry", () => {
    const result = validateRiskReward(makeInstruction({ stopLoss: 600 }));
    expect(result).toEqual({ pass: false, reason: "Stop-loss must be below entry price." });
  });

  it("fails when no targets are specified", () => {
    const result = validateRiskReward(makeInstruction({ targets: [] }));
    expect(result).toEqual({ pass: false, reason: "No T1 target specified." });
  });
});

describe("validateConcentration", () => {
  beforeEach(() => {
    fetchHoldings.mockReset();
  });

  it("passes when the new position is 20% of portfolio", async () => {
    fetchHoldings.mockResolvedValue(ok([makeHolding({ quantity: 1000, last_price: 1000 })]));
    // portfolio = 1,000,000; new = 200 * 1000 = 200,000 → 200,000 / 1,200,000 ≈ 16.7%
    const result = await validateConcentration(200, 1000);
    expect(result.pass).toBe(true);
  });

  it("fails when the new position exceeds the 25% cap", async () => {
    fetchHoldings.mockResolvedValue(ok([makeHolding({ quantity: 1000, last_price: 1000 })]));
    // portfolio = 1,000,000; new = 500 * 1000 = 500,000 → 500,000 / 1,500,000 ≈ 33%
    const result = await validateConcentration(500, 1000);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reason).toContain("exceeds 25% single-position cap");
    }
  });

  it("passes when the holdings fetch fails (does not block)", async () => {
    fetchHoldings.mockResolvedValue(err(new UpstoxError("network down")));
    const result = await validateConcentration(500, 1000);
    expect(result.pass).toBe(true);
  });
});

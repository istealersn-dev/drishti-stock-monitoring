import { describe, expect, it } from "vitest";

import type { GttOrder } from "../gtt/gtt.schema.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

import { formatGtts, formatHoldings, formatPnl, formatStatus } from "./slackCommands.formatters.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE123A01010",
  trading_symbol: "RELIANCE-EQ",
  company_name: "Reliance Industries",
  quantity: 10,
  average_price: 2800,
  last_price: 2900,
  close_price: 2890,
  pnl: 1000,
  day_change: 10,
  day_change_percentage: 0.35,
  instrument_token: "NSE_EQ|INE123A01010",
  exchange: "NSE",
  product: "CNC",
  ...overrides,
});

const makeGtt = (overrides: Partial<GttOrder> = {}): GttOrder => ({
  order_id: "GTT001",
  trading_symbol: "RELIANCE-EQ",
  exchange: "NSE",
  instrument_token: "NSE_EQ|INE123A01010",
  transaction_type: "SELL",
  quantity: 10,
  product: "CNC",
  order_type: "LIMIT",
  trigger_price: 2600,
  limit_price: 2580,
  status: "active",
  ...overrides,
});

// ── formatStatus ────────────────────────────────────────────────────────────

describe("formatStatus", () => {
  it("renders no-runs state", () => {
    const result = formatStatus({ lastRun: null, dryRun: false, pollIntervalMinutes: 5 });
    expect(result).toContain("No runs recorded yet");
    expect(result).toContain("Dry-run* — OFF");
  });

  it("shows dry-run ON warning", () => {
    const result = formatStatus({ lastRun: null, dryRun: true, pollIntervalMinutes: 5 });
    expect(result).toContain("ON ⚠️");
  });

  it("renders last run details when available", () => {
    const result = formatStatus({
      lastRun: {
        startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
        status: "completed",
        summary: "12 holdings, 0 SL breaches",
      },
      dryRun: false,
      pollIntervalMinutes: 5,
    });
    expect(result).toContain("completed");
    expect(result).toContain("12 holdings");
    expect(result).toContain("Next poll");
  });

  it("shows just now for very recent run", () => {
    const result = formatStatus({
      lastRun: {
        startedAt: new Date().toISOString(),
        status: "completed",
        summary: null,
      },
      dryRun: false,
      pollIntervalMinutes: 5,
    });
    expect(result).toContain("just now");
  });
});

// ── formatPnl ───────────────────────────────────────────────────────────────

describe("formatPnl", () => {
  it("returns empty message for no holdings", () => {
    expect(formatPnl([])).toBe("📊 No holdings found.");
  });

  it("sums day P&L and overall P&L", () => {
    const holdings = [
      makeHolding({ day_change: 10, quantity: 10, pnl: 1000 }),
      makeHolding({
        trading_symbol: "HDFC-EQ",
        day_change: -5,
        day_change_percentage: -0.3,
        quantity: 20,
        pnl: -500,
      }),
    ];
    const result = formatPnl(holdings);
    expect(result).toContain("Day P&L");
    expect(result).toContain("Overall P&L");
    expect(result).toContain("RELIANCE-EQ");
    expect(result).toContain("HDFC-EQ");
  });

  it("shows positive sign for gains", () => {
    const result = formatPnl([makeHolding({ pnl: 1000, day_change: 10 })]);
    expect(result).toMatch(/\+/);
  });
});

// ── formatHoldings ───────────────────────────────────────────────────────────

describe("formatHoldings", () => {
  it("returns empty message for no holdings", () => {
    expect(formatHoldings([])).toBe("📋 No holdings found.");
  });

  it("includes symbol, quantity, LTP, and P&L for each holding", () => {
    const result = formatHoldings([makeHolding()]);
    expect(result).toContain("RELIANCE-EQ");
    expect(result).toContain("×10");
    expect(result).toContain("2,900");
  });

  it("shows count in header", () => {
    const result = formatHoldings([makeHolding(), makeHolding({ trading_symbol: "HDFC-EQ" })]);
    expect(result).toContain("Holdings (2)");
  });
});

// ── formatGtts ───────────────────────────────────────────────────────────────

describe("formatGtts", () => {
  it("returns empty message when no GTTs", () => {
    expect(formatGtts([])).toBe("🔔 No GTT orders found.");
  });

  it("shows active count and total count in header", () => {
    const gtts = [makeGtt(), makeGtt({ order_id: "GTT002", status: "triggered" })];
    const result = formatGtts(gtts);
    expect(result).toContain("1 active of 2 total");
  });

  it("marks active GTT with green circle", () => {
    const result = formatGtts([makeGtt()]);
    expect(result).toContain("🟢");
  });

  it("marks non-active GTT with white circle", () => {
    const result = formatGtts([makeGtt({ status: "triggered" })]);
    expect(result).toContain("⚪");
  });

  it("labels SELL GTTs as SL", () => {
    const result = formatGtts([makeGtt({ transaction_type: "SELL" })]);
    expect(result).toContain("SL");
  });

  it("labels BUY GTTs as BUY", () => {
    const result = formatGtts([makeGtt({ transaction_type: "BUY" })]);
    expect(result).toContain("BUY");
  });
});

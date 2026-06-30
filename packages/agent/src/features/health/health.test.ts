import { describe, it, expect, vi, beforeEach } from "vitest";

import { ok, err, UpstoxError } from "../../shared/errors.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

const { mockChat, mockFetchHoldings, mockConfigAll } = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockFetchHoldings: vi.fn(),
  mockConfigAll: vi.fn(),
}));

vi.mock("../../llm/llmClient.js", () => ({ chat: mockChat }));

vi.mock("../../shared/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: mockFetchHoldings,
}));

vi.mock("../../db/db.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ all: mockConfigAll }),
    }),
  },
}));

vi.mock("../../db/schema.js", () => ({
  stockConfig: { symbol: "symbol", slThreshold: "sl_threshold", isActive: "is_active" },
}));

import { computeHealthReport } from "./health.engine.js";
import { formatHealthReport } from "./health.formatter.js";
import type { PortfolioHealthReport } from "./health.schema.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE001",
  trading_symbol: "AXISBANK",
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
  product: "CNC",
  ...overrides,
});

describe("computeHealthReport", () => {
  beforeEach(() => {
    mockChat.mockReset();
    mockFetchHoldings.mockReset();
    mockConfigAll.mockReset();
    mockChat.mockResolvedValue("Portfolio is healthy.");
  });

  it("calculates capitalAtRisk correctly from the stock_config SL threshold", async () => {
    mockFetchHoldings.mockResolvedValue(
      ok([makeHolding({ trading_symbol: "AXISBANK", quantity: 10, last_price: 1100 })]),
    );
    mockConfigAll.mockReturnValue([{ symbol: "AXISBANK", slThreshold: 1000, isActive: true }]);

    const result = await computeHealthReport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // (1100 - 1000) * 10 = 1000
    expect(result.value.totalCapitalAtRisk).toBe(1000);
  });

  it("identifies underperformers when last_price is more than 5% below average", async () => {
    mockFetchHoldings.mockResolvedValue(
      ok([
        makeHolding({ trading_symbol: "DOWN", average_price: 1000, last_price: 940 }),
        makeHolding({ trading_symbol: "FLAT", average_price: 1000, last_price: 980 }),
      ]),
    );
    mockConfigAll.mockReturnValue([]);

    const result = await computeHealthReport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.underperformers).toHaveLength(1);
    expect(result.value.underperformers[0]?.symbol).toBe("DOWN");
  });

  it("returns err when the holdings fetch fails", async () => {
    mockFetchHoldings.mockResolvedValue(err(new UpstoxError("network down")));
    const result = await computeHealthReport();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("network down");
  });

  it("returns ok with fallback narrative when LLM throws", async () => {
    mockFetchHoldings.mockResolvedValue(ok([makeHolding()]));
    mockConfigAll.mockReturnValue([{ symbol: "AXISBANK", slThreshold: 1000, isActive: true }]);
    mockChat.mockRejectedValue(new Error("LM Studio unreachable"));

    const result = await computeHealthReport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.llmNarrative).toContain("Narrative unavailable");
  });

  it("flags holdings with no stock_config row in overdueForReview", async () => {
    mockFetchHoldings.mockResolvedValue(
      ok([
        makeHolding({ trading_symbol: "AXISBANK" }),
        makeHolding({ trading_symbol: "NEWSTOCK", isin: "INE999" }),
      ]),
    );
    // Only AXISBANK has a config row; NEWSTOCK has never been configured
    mockConfigAll.mockReturnValue([{ symbol: "AXISBANK", slThreshold: 1000, isActive: true }]);

    const result = await computeHealthReport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.overdueForReview).toContain("NEWSTOCK");
  });
});

describe("formatHealthReport", () => {
  const report: PortfolioHealthReport = {
    generatedAt: "2026-06-29T00:00:00.000Z",
    totalPortfolioValue: 1_200_000,
    totalCapitalAtRisk: 150_000,
    capitalAtRiskPct: 12.5,
    mtfBurnRateMonthly: 9000,
    activePositionCount: 3,
    underperformers: [
      { symbol: "DOWN", companyName: "Down Co", buyPrice: 1000, currentLtp: 900, pctDown: 10 },
    ],
    overdueForReview: ["NEEDSL"],
    llmNarrative: "Leverage burn is elevated; tighten the unconfigured stop-loss.",
  };

  it("includes all key metrics in the output string", () => {
    const output = formatHealthReport(report);
    expect(output).toContain("Portfolio Health Report");
    expect(output).toContain("₹12,00,000");
    expect(output).toContain("₹1,50,000");
    expect(output).toContain("12.5%");
    expect(output).toContain("₹9,000");
    expect(output).toContain("DOWN");
    expect(output).toContain("NEEDSL");
    expect(output).toContain("Leverage burn is elevated");
  });
});

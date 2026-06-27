import { describe, it, expect, vi } from "vitest";

const { mockChat } = vi.hoisted(() => ({ mockChat: vi.fn() }));

vi.mock("../../llm/llmClient.js", () => ({ chat: mockChat }));

import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

import { analysePortfolio } from "./insights.chain.js";

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

const emptyLtpMap: Record<string, LtpData> = {};
const ltpMap: Record<string, LtpData> = {
  "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
};

const validOutput = JSON.stringify({
  decisions: [
    {
      symbol: "AXISBANK-EQ",
      action: "hold",
      reasoning: "Price above SL, no action needed.",
      gttParams: null,
    },
  ],
  portfolioSummary: "Portfolio healthy.",
});

describe("analysePortfolio", () => {
  it("returns ok with valid LLM output", async () => {
    mockChat.mockResolvedValue(validOutput);
    const result = await analysePortfolio([makeHolding()], ltpMap, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisions[0]?.action).toBe("hold");
    expect(result.value.portfolioSummary).toBe("Portfolio healthy.");
  });

  it("strips markdown code fences before parsing", async () => {
    mockChat.mockResolvedValue("```json\n" + validOutput + "\n```");
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(true);
  });

  it("returns err when LLM output is not JSON", async () => {
    mockChat.mockResolvedValue("Sorry, I cannot help with that.");
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });

  it("returns err when LLM output fails schema validation", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ decisions: [], portfolioSummary: "" }));
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("schema validation");
  });

  it("rejects action 'buy' — not in schema", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        decisions: [{ symbol: "X", action: "buy", reasoning: "r", gttParams: null }],
        portfolioSummary: "s",
      }),
    );
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("schema validation");
  });

  it("returns err when LLM call throws", async () => {
    mockChat.mockRejectedValue(new Error("connection refused"));
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("connection refused");
  });

  it("accepts gtt_modify with valid gttParams", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        decisions: [
          {
            symbol: "AXISBANK-EQ",
            action: "gtt_modify",
            reasoning: "Trail SL up.",
            gttParams: { newTriggerPrice: 1050, newLimitPrice: 1040 },
          },
        ],
        portfolioSummary: "SL trailed.",
      }),
    );
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisions[0]?.action).toBe("gtt_modify");
    expect(result.value.decisions[0]?.gttParams?.newTriggerPrice).toBe(1050);
  });
});

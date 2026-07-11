import { describe, it, expect, vi } from "vitest";

const { mockChatOnce } = vi.hoisted(() => ({ mockChatOnce: vi.fn() }));

vi.mock("../../llm/llmClient.js", () => ({
  chatOnce: mockChatOnce,
  PORTFOLIO_MAX_TOKENS: 8192,
  PORTFOLIO_LLM_TIMEOUT_MS: 300_000,
}));

import type { Holding, Quote } from "../../broker/brokerClient.types.js";

import { analysePortfolio } from "./insights.chain.js";

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

const emptyLtpMap: Record<string, Quote> = {};
const ltpMap: Record<string, Quote> = {
  "NSE_EQ|INE238A01034": { lastPrice: 1100, instrumentToken: "NSE_EQ|INE238A01034" },
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
    mockChatOnce.mockResolvedValue(validOutput);
    const result = await analysePortfolio([makeHolding()], ltpMap, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisions[0]?.action).toBe("hold");
    expect(result.value.portfolioSummary).toBe("Portfolio healthy.");
  });

  it("strips markdown code fences before parsing", async () => {
    mockChatOnce.mockResolvedValue("```json\n" + validOutput + "\n```");
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(true);
  });

  it("returns err when LLM output is not JSON", async () => {
    mockChatOnce.mockResolvedValue("Sorry, I cannot help with that.");
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });

  it("returns err when LLM output fails schema validation", async () => {
    mockChatOnce.mockResolvedValue(JSON.stringify({ decisions: [], portfolioSummary: "" }));
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("schema validation");
  });

  it("rejects action 'buy' — not in schema", async () => {
    mockChatOnce.mockResolvedValue(
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
    mockChatOnce.mockRejectedValue(new Error("connection refused"));
    const result = await analysePortfolio([makeHolding()], emptyLtpMap, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("connection refused");
  });

  it("accepts gtt_modify with valid gttParams", async () => {
    mockChatOnce.mockResolvedValue(
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

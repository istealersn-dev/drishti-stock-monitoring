import { describe, it, expect, vi } from "vitest";

const { mockChat } = vi.hoisted(() => ({ mockChat: vi.fn() }));

vi.mock("../../llm/llmClient.js", () => ({ chat: mockChat }));
vi.mock("../../shared/env.js", () => ({
  env: {
    LM_STUDIO_BASE_URL: "http://localhost:1234",
    LM_MODEL: "test-model",
    UPSTOX_EXTENDED_TOKEN: "",
    UPSTOX_ACCESS_TOKEN: "",
  },
}));

import { calculateSuggestedQty } from "./instructions.executor.js";
import { parseInstruction } from "./instructions.parser.js";
import { resolveSymbol } from "./instructions.resolver.js";

describe("parseInstruction", () => {
  it("parses the canonical format correctly", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        stockName: "Ramco Systems",
        action: "BUY",
        entryLow: 560,
        entryHigh: 580,
        stopLoss: 520,
        targets: [
          { price: 680, isOpenEnded: false },
          { price: 800, isOpenEnded: true },
        ],
      }),
    );

    const result = await parseInstruction("Ramco Systems Buy 560-580 SL 520 Tgt 680 800+");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stockName).toBe("Ramco Systems");
    expect(result.value.action).toBe("BUY");
    expect(result.value.entryLow).toBe(560);
    expect(result.value.entryHigh).toBe(580);
    expect(result.value.stopLoss).toBe(520);
    expect(result.value.targets).toHaveLength(2);
    expect(result.value.targets[1]?.isOpenEnded).toBe(true);
  });

  it("handles single entry price (entryLow === entryHigh)", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        stockName: "TATAMOTORS",
        action: "BUY",
        entryLow: 780,
        entryHigh: 780,
        stopLoss: 740,
        targets: [{ price: 850, isOpenEnded: false }],
      }),
    );

    const result = await parseInstruction("TATAMOTORS buy 780 SL 740 tgt 850");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entryLow).toBe(780);
    expect(result.value.entryHigh).toBe(780);
  });

  it("handles missing T2 (single target only)", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        stockName: "HDFCBANK",
        action: "BUY",
        entryLow: 1600,
        entryHigh: 1650,
        stopLoss: 1550,
        targets: [{ price: 1800, isOpenEnded: false }],
      }),
    );

    const result = await parseInstruction("Buy HDFCBANK 1600-1650 sl 1550 target 1800");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targets).toHaveLength(1);
    expect(result.value.targets[0]?.isOpenEnded).toBe(false);
  });

  it("handles open-ended T2 (900+)", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        stockName: "INFY",
        action: "BUY",
        entryLow: 780,
        entryHigh: 800,
        stopLoss: 750,
        targets: [
          { price: 850, isOpenEnded: false },
          { price: 900, isOpenEnded: true },
        ],
      }),
    );

    const result = await parseInstruction("INFY buy 780-800 SL 750 tgt 850 900+");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lastTarget = result.value.targets.at(-1);
    expect(lastTarget?.isOpenEnded).toBe(true);
    expect(lastTarget?.price).toBe(900);
  });

  it("forces action to BUY even when the input has no literal 'buy' word and the LLM returns null", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        stockName: "Goldbees",
        action: null,
        entryLow: 120,
        entryHigh: 123,
        stopLoss: 110,
        targets: [
          { price: 140, isOpenEnded: false },
          { price: 170, isOpenEnded: true },
        ],
      }),
    );

    const result = await parseInstruction("Goldbees 120-123 SL 110 Tgt 140-170");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.action).toBe("BUY");
  });

  it("returns err when LLM returns invalid JSON", async () => {
    mockChat.mockResolvedValue("Sorry, I cannot parse that.");

    const result = await parseInstruction("garbage");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });

  it("returns err when LLM JSON fails schema validation", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ action: "SELL", stockName: "X" }));

    const result = await parseInstruction("some text");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("schema validation");
  });

  it("returns err when LLM call throws", async () => {
    mockChat.mockRejectedValue(new Error("connection refused"));

    const result = await parseInstruction("any text");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("connection refused");
  });

  it("strips markdown code fences before parsing JSON", async () => {
    mockChat.mockResolvedValue(
      "```json\n" +
        JSON.stringify({
          stockName: "WIPRO",
          action: "BUY",
          entryLow: 300,
          entryHigh: 310,
          stopLoss: 280,
          targets: [{ price: 350, isOpenEnded: false }],
        }) +
        "\n```",
    );

    const result = await parseInstruction("WIPRO buy 300-310 SL 280 tgt 350");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stockName).toBe("WIPRO");
  });
});

// ── resolveSymbol tests ───────────────────────────────────────────────────────

describe("resolveSymbol", () => {
  it("returns err when no NSE equity is found for the stock name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", data: [] }),
      }),
    );

    const result = await resolveSymbol("UnknownStockXYZ123");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("No NSE equity found");

    vi.unstubAllGlobals();
  });

  it("returns err when the Upstox search API responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      }),
    );

    const result = await resolveSymbol("RELIANCE");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Symbol search failed");

    vi.unstubAllGlobals();
  });
});

// ── calculateSuggestedQty tests ───────────────────────────────────────────────

describe("calculateSuggestedQty", () => {
  it("calculates qty from midpoint of entry range", () => {
    expect(calculateSuggestedQty(48_000, 580, 560)).toBe(Math.floor(48_000 / 570));
  });

  it("uses entryHigh as midpoint when no entryLow provided", () => {
    expect(calculateSuggestedQty(10_000, 500)).toBe(Math.floor(10_000 / 500));
  });

  it("returns minimum of 1 for tiny margin", () => {
    expect(calculateSuggestedQty(100, 5000)).toBe(1);
  });

  it("returns minimum of 1 when margin is zero", () => {
    expect(calculateSuggestedQty(0, 500)).toBe(1);
  });
});

import { describe, it, expect, vi } from "vitest";

const { mockChatOnce } = vi.hoisted(() => ({ mockChatOnce: vi.fn() }));

vi.mock("../../llm/llmClient.js", () => ({
  chatOnce: mockChatOnce,
  INTENT_CLASSIFICATION_MAX_TOKENS: 200,
  INTENT_CLASSIFICATION_TIMEOUT_MS: 20_000,
}));

import { classifyIntent } from "./instructions.intent.js";

describe("classifyIntent", () => {
  it("classifies a canonical buy instruction as ORDER", async () => {
    mockChatOnce.mockResolvedValue(JSON.stringify({ intent: "ORDER", clarifyingQuestion: null }));

    const result = await classifyIntent("Ramco Systems Buy 560-580 SL 520 Tgt 680 800+");
    expect(result.intent).toBe("ORDER");
    expect(result.clarifyingQuestion).toBeNull();
  });

  it("classifies a plain question as QUERY", async () => {
    mockChatOnce.mockResolvedValue(JSON.stringify({ intent: "QUERY", clarifyingQuestion: null }));

    const result = await classifyIntent("how's Ramco doing");
    expect(result.intent).toBe("QUERY");
  });

  it("classifies a vague stock-name-only mention as AMBIGUOUS with a clarifying question", async () => {
    mockChatOnce.mockResolvedValue(
      JSON.stringify({
        intent: "AMBIGUOUS",
        clarifyingQuestion: "Do you want to buy Ramco Systems, or ask about it?",
      }),
    );

    const result = await classifyIntent("Ramco Systems");
    expect(result.intent).toBe("AMBIGUOUS");
    expect(result.clarifyingQuestion).toBe("Do you want to buy Ramco Systems, or ask about it?");
  });

  it("falls back to regex ORDER match when the LLM returns non-JSON", async () => {
    mockChatOnce.mockResolvedValue("I'm not sure what you mean.");

    const result = await classifyIntent("TATAMOTORS buy 780 SL 740 tgt 850");
    expect(result.intent).toBe("ORDER");
  });

  it("falls back to regex QUERY match when the LLM returns non-JSON and no buy pattern is present", async () => {
    mockChatOnce.mockResolvedValue("not json");

    const result = await classifyIntent("what's my PnL today");
    expect(result.intent).toBe("QUERY");
  });

  it("falls back to regex when the response fails schema validation", async () => {
    mockChatOnce.mockResolvedValue(JSON.stringify({ intent: "MAYBE" }));

    const result = await classifyIntent("Buy HDFCBANK 1600-1650 sl 1550 target 1800");
    expect(result.intent).toBe("ORDER");
  });

  it("falls back to regex when the LLM call throws", async () => {
    mockChatOnce.mockRejectedValue(new Error("connection refused"));

    const result = await classifyIntent("what's the news on Infosys");
    expect(result.intent).toBe("QUERY");
  });
});

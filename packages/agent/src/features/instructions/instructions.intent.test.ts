import { describe, it, expect, vi } from "vitest";

const { mockChatOnceNoReasoning, mockValues, mockInsert } = vi.hoisted(() => {
  const run = vi.fn();
  const values = vi.fn(() => ({ run }));
  const insert = vi.fn(() => ({ values }));
  return { mockChatOnceNoReasoning: vi.fn(), mockValues: values, mockInsert: insert };
});

vi.mock("../../llm/llmClient.js", () => ({
  chatOnceNoReasoning: mockChatOnceNoReasoning,
  INTENT_CLASSIFICATION_MAX_TOKENS: 200,
  INTENT_CLASSIFICATION_TIMEOUT_MS: 20_000,
}));

vi.mock("../../db/db.js", () => ({ db: { insert: mockInsert } }));

vi.mock("../../shared/env.js", () => ({ env: { DRISHTI_DRY_RUN: false } }));

import { classifyIntent } from "./instructions.intent.js";

describe("classifyIntent", () => {
  it("classifies a canonical buy instruction as ORDER", async () => {
    mockChatOnceNoReasoning.mockResolvedValue(
      JSON.stringify({ intent: "ORDER", clarifyingQuestion: null }),
    );

    const result = await classifyIntent("Ramco Systems Buy 560-580 SL 520 Tgt 680 800+");
    expect(result.intent).toBe("ORDER");
    expect(result.clarifyingQuestion).toBeNull();
  });

  it("classifies a plain question as QUERY", async () => {
    mockChatOnceNoReasoning.mockResolvedValue(
      JSON.stringify({ intent: "QUERY", clarifyingQuestion: null }),
    );

    const result = await classifyIntent("how's Ramco doing");
    expect(result.intent).toBe("QUERY");
  });

  it("classifies a vague stock-name-only mention as AMBIGUOUS with a clarifying question", async () => {
    mockChatOnceNoReasoning.mockResolvedValue(
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
    mockChatOnceNoReasoning.mockResolvedValue("I'm not sure what you mean.");

    const result = await classifyIntent("TATAMOTORS buy 780 SL 740 tgt 850");
    expect(result.intent).toBe("ORDER");
  });

  it("falls back to regex QUERY match when the LLM returns non-JSON and no buy pattern is present", async () => {
    mockChatOnceNoReasoning.mockResolvedValue("not json");

    const result = await classifyIntent("what's my PnL today");
    expect(result.intent).toBe("QUERY");
  });

  it("falls back to regex when the response fails schema validation", async () => {
    mockChatOnceNoReasoning.mockResolvedValue(JSON.stringify({ intent: "MAYBE" }));

    const result = await classifyIntent("Buy HDFCBANK 1600-1650 sl 1550 target 1800");
    expect(result.intent).toBe("ORDER");
  });

  it("falls back to regex when the LLM call throws", async () => {
    mockChatOnceNoReasoning.mockRejectedValue(new Error("connection refused"));

    const result = await classifyIntent("what's the news on Infosys");
    expect(result.intent).toBe("QUERY");
  });

  it("logs an intent_classification_failed row to agent_logs when the LLM call throws", async () => {
    mockChatOnceNoReasoning.mockRejectedValue(new Error("connection refused"));

    await classifyIntent("what's the news on Infosys");

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "intent_classification_failed",
        error: "connection refused",
      }),
    );
  });
});

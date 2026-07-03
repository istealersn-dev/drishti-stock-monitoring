import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRunToolLoop, mockSearchWeb, mockValues, mockInsert } = vi.hoisted(() => {
  const run = vi.fn();
  const values = vi.fn(() => ({ run }));
  const insert = vi.fn(() => ({ values }));
  return {
    mockRunToolLoop: vi.fn(),
    mockSearchWeb: vi.fn(),
    mockValues: values,
    mockInsert: insert,
  };
});

vi.mock("../../llm/toolLoop.js", () => ({ runToolLoop: mockRunToolLoop }));

vi.mock("../../llm/llmClient.js", () => ({
  INSTRUCTION_ANALYSIS_MAX_TOKENS: 400,
  INSTRUCTION_ANALYSIS_TIMEOUT_MS: 60_000,
}));

vi.mock("../../db/db.js", () => ({ db: { insert: mockInsert } }));

vi.mock("../../shared/env.js", () => ({ env: { DRISHTI_DRY_RUN: false } }));

vi.mock("../websearch/webSearch.tools.js", () => ({ searchWeb: mockSearchWeb }));

import { err, ok } from "../../shared/errors.js";

import { analyzeBuyInstruction } from "./instructions.analysis.js";
import type { ParsedInstruction } from "./instructions.schema.js";

const instruction: ParsedInstruction = {
  stockName: "Ramco Systems",
  action: "BUY",
  entryLow: 560,
  entryHigh: 580,
  stopLoss: 520,
  targets: [
    { price: 680, isOpenEnded: false },
    { price: 800, isOpenEnded: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeBuyInstruction", () => {
  it("returns the analysis text on success", async () => {
    mockRunToolLoop.mockResolvedValue("R:R looks fine, no major news flagged.");

    const result = await analyzeBuyInstruction(instruction, "RAMCOSYS-EQ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("R:R looks fine, no major news flagged.");
  });

  it("disables the model's reasoning phase, since INSTRUCTION_ANALYSIS_MAX_TOKENS is small enough for reasoning to consume the whole budget", async () => {
    mockRunToolLoop.mockResolvedValue("R:R looks fine, no major news flagged.");

    await analyzeBuyInstruction(instruction, "RAMCOSYS-EQ");

    expect(mockRunToolLoop).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ reasoningEffort: "none" }),
    );
  });

  it("invokes the web_search executor with the model's arguments and returns search results", async () => {
    mockSearchWeb.mockResolvedValue(ok("Recent news: Ramco Systems Q1 results beat estimates."));

    mockRunToolLoop.mockImplementation(async (_messages, _tools, executors) => {
      const searchResult = await executors.web_search(
        JSON.stringify({ symbol: "RAMCOSYS-EQ", query: "Ramco Systems stock news" }),
      );
      return `Analysis based on: ${searchResult}`;
    });

    const result = await analyzeBuyInstruction(instruction, "RAMCOSYS-EQ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(mockSearchWeb).toHaveBeenCalledWith("RAMCOSYS-EQ", "Ramco Systems stock news");
    expect(result.value).toContain("Q1 results beat estimates");
  });

  it("logs to agent_logs and returns an executor error string when web_search fails", async () => {
    mockSearchWeb.mockResolvedValue(err(new Error("Tavily down")));

    mockRunToolLoop.mockImplementation(async (_messages, _tools, executors) => {
      return executors.web_search(
        JSON.stringify({ symbol: "RAMCOSYS-EQ", query: "Ramco Systems stock news" }),
      );
    });

    const result = await analyzeBuyInstruction(instruction, "RAMCOSYS-EQ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("Web search failed: Tavily down");
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: "buy_analysis_web_search_failed" }),
    );
  });

  it("degrades to an LlmError result when runToolLoop throws, without throwing itself", async () => {
    mockRunToolLoop.mockRejectedValue(new Error("LM Studio timeout"));

    const result = await analyzeBuyInstruction(instruction, "RAMCOSYS-EQ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("LM Studio timeout");
  });
});

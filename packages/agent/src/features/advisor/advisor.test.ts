import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockChat, mockRun, mockValues, mockInsert, mockFetchHoldings } = vi.hoisted(() => {
  const run = vi.fn();
  const values = vi.fn(() => ({ run }));
  const insert = vi.fn(() => ({ values }));
  return {
    mockChat: vi.fn(),
    mockRun: run,
    mockValues: values,
    mockInsert: insert,
    mockFetchHoldings: vi.fn(),
  };
});

vi.mock("../../llm/llmClient.js", () => ({
  chat: mockChat,
}));

vi.mock("../../db/db.js", () => ({
  db: { insert: mockInsert },
}));

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: mockFetchHoldings,
}));

import { ok } from "../../shared/errors.js";

import { askAdvisor, generateTradeSetup } from "./advisor.chain.js";
import type { AdvisoryRequest } from "./advisor.schema.js";

const request: AdvisoryRequest = {
  question: "Should I trim my AXISBANK position?",
  sessionId: "session-1",
  channel: "slack",
};

const validSetup = JSON.stringify({
  entryLow: 560,
  entryHigh: 580,
  stopLoss: 520,
  targets: [
    { price: 680, isOpenEnded: false },
    { price: 800, isOpenEnded: true },
  ],
  rationale: "Entry above 200 DMA, SL at prior swing low, 1:3 R:R to T2.",
});

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnValue({ values: mockValues });
  mockFetchHoldings.mockResolvedValue(ok([]));
});

describe("askAdvisor", () => {
  it("saves two rows to advisory_conversations", async () => {
    mockChat.mockResolvedValue("Hold for now; SL at 520.");
    await askAdvisor(request);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockRun).toHaveBeenCalledTimes(2);
    const userRow = (mockValues.mock.calls as unknown as [Record<string, string>][])[0]?.[0];
    const assistantRow = (mockValues.mock.calls as unknown as [Record<string, string>][])[1]?.[0];
    expect(userRow?.["role"]).toBe("user");
    expect(userRow?.["sessionId"]).toBe("session-1");
    expect(assistantRow?.["role"]).toBe("assistant");
    expect(assistantRow?.["sessionId"]).toBe("session-1");
  });

  it("returns ok with the answer when chat succeeds", async () => {
    mockChat.mockResolvedValue("Hold for now; SL at 520.");
    const result = await askAdvisor(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answer).toBe("Hold for now; SL at 520.");
    expect(result.value.sessionId).toBe("session-1");
  });

  it("returns err when chat throws", async () => {
    mockChat.mockRejectedValue(new Error("connection refused"));
    const result = await askAdvisor(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("connection refused");
  });
});

describe("generateTradeSetup", () => {
  it("parses valid JSON correctly", async () => {
    mockChat.mockResolvedValue(validSetup);
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.symbol).toBe("RAMCOSYS-EQ");
    expect(result.value.entryLow).toBe(560);
    expect(result.value.targets).toHaveLength(2);
    expect(result.value.targets[1]?.isOpenEnded).toBe(true);
  });

  it("returns err when the LLM returns non-JSON", async () => {
    mockChat.mockResolvedValue("Sorry, I cannot generate that setup.");
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });
});

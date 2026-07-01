import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockChatWithDrishti,
  mockGenerateText,
  mockToGeminiHistory,
  mockRun,
  mockValues,
  mockInsert,
  mockTransaction,
  mockFetchHoldings,
  mockDbSelect,
} = vi.hoisted(() => {
  const run = vi.fn();
  const values = vi.fn(() => ({ run }));
  const insert = vi.fn(() => ({ values }));
  const transaction = vi.fn((callback: (tx: { insert: typeof insert }) => void) => {
    callback({ insert });
  });
  return {
    mockChatWithDrishti: vi.fn(),
    mockGenerateText: vi.fn(),
    // Mirrors the real toGeminiHistory role mapping, so history-shape assertions
    // (e.g. role alternation) exercise realistic data instead of an empty stub.
    mockToGeminiHistory: vi.fn((rows: Array<{ role: string; content: string }>) =>
      rows.map((r) => ({
        role: r.role === "assistant" ? "model" : "user",
        parts: [{ text: r.content }],
      })),
    ),
    mockRun: run,
    mockValues: values,
    mockInsert: insert,
    mockTransaction: transaction,
    mockFetchHoldings: vi.fn(),
    mockDbSelect: vi.fn(),
  };
});

vi.mock("../../llm/geminiClient.js", () => ({
  chatWithDrishti: mockChatWithDrishti,
  generateText: mockGenerateText,
  toGeminiHistory: mockToGeminiHistory,
}));

vi.mock("../../db/db.js", () => ({
  db: { insert: mockInsert, transaction: mockTransaction, select: mockDbSelect },
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: mockFetchHoldings,
}));

import { ok } from "../../shared/errors.js";

import { askAdvisor, generateTradeSetup } from "./advisor.chain.js";
import { buildAdvisoryContext } from "./advisor.prompts.js";
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
  mockTransaction.mockImplementation((callback: (tx: { insert: typeof mockInsert }) => void) => {
    callback({ insert: mockInsert });
  });
  mockFetchHoldings.mockResolvedValue(ok([]));
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
        }),
      }),
    }),
  });
});

describe("askAdvisor", () => {
  it("saves two rows in a single transaction", async () => {
    mockChatWithDrishti.mockResolvedValue("Hold for now; SL at 520.");
    await askAdvisor(request);
    expect(mockTransaction).toHaveBeenCalledOnce();
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
    mockChatWithDrishti.mockResolvedValue("Hold for now; SL at 520.");
    const result = await askAdvisor(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answer).toBe("Hold for now; SL at 520.");
    expect(result.value.sessionId).toBe("session-1");
  });

  it("returns err when chat throws", async () => {
    mockChatWithDrishti.mockRejectedValue(new Error("connection refused"));
    const result = await askAdvisor(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("connection refused");
  });

  it("does not enable grounding for a routine portfolio question", async () => {
    mockChatWithDrishti.mockResolvedValue("Hold for now.");
    await askAdvisor(request);
    expect(mockChatWithDrishti).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      { grounding: false },
    );
  });

  it("enables grounding when the question needs live web data", async () => {
    mockChatWithDrishti.mockResolvedValue("Here's the latest news.");
    await askAdvisor({ ...request, question: "Any recent news on RAMCOSYS?" });
    expect(mockChatWithDrishti).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      { grounding: true },
    );
  });

  it("never sends Gemini history starting on an assistant turn, even if the newest row alone exceeds the char budget", async () => {
    const oversizedAnswer = "A".repeat(7000); // exceeds the 6000-char history budget alone
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([
                {
                  role: "assistant",
                  content: oversizedAnswer,
                  createdAt: "2026-07-01T10:01:00.000Z",
                },
                {
                  role: "user",
                  content: "Should I hold?",
                  createdAt: "2026-07-01T10:00:00.000Z",
                },
              ]),
            }),
          }),
        }),
      }),
    });
    mockChatWithDrishti.mockResolvedValue("Hold for now.");

    await askAdvisor(request);

    const history = mockChatWithDrishti.mock.calls[0]?.[1] as Array<{ role: string }>;
    // Must keep the paired user question rather than dropping the whole turn.
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe("user");
    expect(history[1]?.role).toBe("model");
  });

  it("drops a truly unpaired oldest-row assistant turn (no earlier row to pull in)", async () => {
    // A single orphaned assistant row with nothing before it in the fetched window —
    // shouldn't happen via the normal atomic-pair write path, but the trim logic
    // must not throw or return malformed history if it ever does.
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([
                {
                  role: "assistant",
                  content: "Orphaned reply.",
                  createdAt: "2026-07-01T10:00:00.000Z",
                },
              ]),
            }),
          }),
        }),
      }),
    });
    mockChatWithDrishti.mockResolvedValue("Hold for now.");

    await askAdvisor(request);

    const history = mockChatWithDrishti.mock.calls[0]?.[1] as Array<{ role: string }>;
    expect(history).toHaveLength(0);
  });
});

describe("buildAdvisoryContext", () => {
  it("keeps output within 6000-token (~24000 char) budget for a large portfolio", () => {
    const largeHolding = {
      isin: "INE000000000",
      trading_symbol: "STOCKNAME-EQ",
      company_name: "A".repeat(200),
      quantity: 100,
      average_price: 1000,
      last_price: 1100,
      pnl: 10000,
    };
    const oversizedPortfolio = Array.from({ length: 200 }, (_, index) => ({
      ...largeHolding,
      isin: `INE${String(index).padStart(9, "0")}`,
    }));
    const result = buildAdvisoryContext(oversizedPortfolio, "Should I hold?");
    expect(result.length).toBeLessThanOrEqual(24000);
    expect(result).toContain("Should I hold?");
  });
});

describe("generateTradeSetup", () => {
  it("parses valid JSON correctly", async () => {
    mockGenerateText.mockResolvedValue(validSetup);
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.symbol).toBe("RAMCOSYS-EQ");
    expect(result.value.entryLow).toBe(560);
    expect(result.value.targets).toHaveLength(2);
    expect(result.value.targets[1]?.isOpenEnded).toBe(true);
  });

  it("returns err when the LLM returns non-JSON", async () => {
    mockGenerateText.mockResolvedValue("Sorry, I cannot generate that setup.");
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });
});

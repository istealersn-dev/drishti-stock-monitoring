import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockChat,
  mockChatOnce,
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
    mockChat: vi.fn(),
    mockChatOnce: vi.fn(),
    mockRun: run,
    mockValues: values,
    mockInsert: insert,
    mockTransaction: transaction,
    mockFetchHoldings: vi.fn(),
    mockDbSelect: vi.fn(),
  };
});

vi.mock("../../llm/llmClient.js", () => ({
  chat: mockChat,
  chatOnce: mockChatOnce,
  ADVISOR_LLM_TIMEOUT_MS: 180_000,
  ADVISOR_MAX_TOKENS: 1500,
  ADVISOR_TEMPERATURE: 0.7,
  TRADE_SETUP_MAX_TOKENS: 4096,
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
    mockChat.mockResolvedValue("Hold for now; SL at 520.");
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

  it("sends the system prompt and question as the first and last messages", async () => {
    mockChat.mockResolvedValue("Hold for now.");
    await askAdvisor(request);
    const messages = mockChat.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe("system");
    expect(messages.at(-1)?.role).toBe("user");
    expect(messages.at(-1)?.content).toContain(request.question);
  });

  it("uses an elevated timeout and conversational temperature for local-model inference", async () => {
    mockChat.mockResolvedValue("Hold for now.");
    await askAdvisor(request);
    const [, maxTokens, timeoutMs, temperature] = mockChat.mock.calls[0] as [
      unknown,
      number,
      number,
      number,
    ];
    expect(maxTokens).toBe(1500);
    expect(timeoutMs).toBe(180_000);
    expect(temperature).toBe(0.7);
  });

  it("never sends history starting on an assistant turn, even if the newest row alone exceeds the char budget", async () => {
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
    mockChat.mockResolvedValue("Hold for now.");

    await askAdvisor(request);

    const messages = mockChat.mock.calls[0]?.[0] as Array<{ role: string }>;
    const history = messages.slice(1, -1);
    // Must keep the paired user question rather than dropping the whole turn.
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe("user");
    expect(history[1]?.role).toBe("assistant");
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
    mockChat.mockResolvedValue("Hold for now.");

    await askAdvisor(request);

    const messages = mockChat.mock.calls[0]?.[0] as Array<{ role: string }>;
    const history = messages.slice(1, -1);
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
    mockChatOnce.mockResolvedValue(validSetup);
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.symbol).toBe("RAMCOSYS-EQ");
    expect(result.value.entryLow).toBe(560);
    expect(result.value.targets).toHaveLength(2);
    expect(result.value.targets[1]?.isOpenEnded).toBe(true);
  });

  it("returns err when the LLM returns non-JSON", async () => {
    mockChatOnce.mockResolvedValue("Sorry, I cannot generate that setup.");
    const result = await generateTradeSetup("RAMCOSYS-EQ", "{}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("non-JSON");
  });
});

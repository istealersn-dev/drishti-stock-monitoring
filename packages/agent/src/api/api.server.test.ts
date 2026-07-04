import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbSelect, mockDbInsert, mockIsDryRunActive } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockIsDryRunActive: vi.fn().mockReturnValue(false),
}));

vi.mock("../db/db.js", () => ({ db: { select: mockDbSelect, insert: mockDbInsert } }));
vi.mock("../shared/dryRun.js", () => ({ isDryRunActive: mockIsDryRunActive }));
vi.mock("../db/schema.js", () => ({
  agentRuns: {},
  agentLogs: {},
  gttOrders: {},
  pendingApprovals: {},
  agentSettings: {},
}));
vi.mock("../shared/env.js", () => ({
  env: {
    DRISHTI_DRY_RUN: false,
    DRISHTI_POLL_INTERVAL_MINUTES: 5,
    DRISHTI_MARKET_OPEN: "09:15",
    DRISHTI_MARKET_CLOSE: "15:30",
    DRISHTI_APPROVAL_TIMEOUT_MINUTES: 10,
    AGENT_API_PORT: 4000,
  },
}));
vi.mock("../features/portfolio/portfolio.cache.js", () => ({
  getCachedHoldings: vi.fn().mockReturnValue({ holdings: [], cachedAt: null }),
}));
vi.mock("../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  queryRuns,
  queryGttOrders,
  queryLogs,
  querySettings,
  queryApprovals,
  validateSettingsPatch,
} from "./api.server.js";

const makeChain = (result: unknown[]): ReturnType<typeof vi.fn> => {
  const allFunction = vi.fn().mockReturnValue(result);
  const orderByChain = { all: allFunction, limit: vi.fn().mockReturnValue({ all: allFunction }) };
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue(orderByChain),
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue(orderByChain),
        all: allFunction,
      }),
      all: allFunction,
      limit: vi.fn().mockReturnValue({ all: allFunction }),
    }),
  });
};

describe("queryRuns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns rows from agent_runs", () => {
    const rows = [{ id: "run-1", status: "completed", startedAt: "2026-01-01" }];
    mockDbSelect.mockImplementation(makeChain(rows));
    const result = queryRuns();
    expect(result).toEqual(rows);
  });
});

describe("queryGttOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all orders when no status filter", () => {
    const rows = [{ id: "gtt-1", symbol: "AXISBANK-EQ", status: "active" }];
    mockDbSelect.mockImplementation(makeChain(rows));
    const result = queryGttOrders();
    expect(result).toEqual(rows);
  });
});

describe("queryLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns logs without filter", () => {
    const rows = [{ id: 1, action: "hold", runId: "run-1" }];
    mockDbSelect.mockImplementation(makeChain(rows));
    const result = queryLogs();
    expect(result).toEqual(rows);
  });
});

describe("querySettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns env defaults when no DB overrides", () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
    });
    mockIsDryRunActive.mockReturnValue(false);
    const result = querySettings();
    expect(result).toMatchObject({
      dryRun: false,
      pauseAgent: false,
      pollIntervalMinutes: 5,
      marketOpen: "09:15",
      marketClose: "15:30",
    });
  });

  it("applies DB override for dry_run", () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([{ key: "dry_run", value: "true" }]),
      }),
    });
    mockIsDryRunActive.mockReturnValue(true);
    const result = querySettings();
    expect(result["dryRun"]).toBe(true);
  });

  it("applies DB override for pause_agent from the same bulk read as other settings", () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([{ key: "pause_agent", value: "true" }]),
      }),
    });
    const result = querySettings();
    expect(result["pauseAgent"]).toBe(true);
  });
});

describe("validateSettingsPatch", () => {
  it("accepts a valid pause_agent value", () => {
    const result = validateSettingsPatch({ pause_agent: "true" });
    expect(result).toEqual({ ok: true, entries: [{ key: "pause_agent", value: "true" }] });
  });

  it("accepts a valid poll_interval_minutes value and coerces it to a string", () => {
    const result = validateSettingsPatch({ poll_interval_minutes: "10" });
    expect(result).toEqual({ ok: true, entries: [{ key: "poll_interval_minutes", value: "10" }] });
  });

  it("rejects a non-boolean-string value for pause_agent instead of silently failing open", () => {
    const result = validateSettingsPatch({ pause_agent: "1" });
    expect(result).toEqual({ ok: false, error: "Invalid value for pause_agent" });
  });

  it('rejects a JS boolean for pause_agent (must be the string "true"/"false")', () => {
    const result = validateSettingsPatch({ pause_agent: true });
    expect(result).toEqual({ ok: false, error: "Invalid value for pause_agent" });
  });

  it("rejects an out-of-range poll_interval_minutes", () => {
    const result = validateSettingsPatch({ poll_interval_minutes: "120" });
    expect(result).toEqual({ ok: false, error: "Invalid value for poll_interval_minutes" });
  });

  it("ignores unknown keys", () => {
    const result = validateSettingsPatch({ not_a_real_setting: "x" });
    expect(result).toEqual({ ok: true, entries: [] });
  });
});

describe("queryApprovals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses stored instruction JSON into parsedInstruction field", () => {
    const parsedJson = JSON.stringify({
      stockName: "Axis Bank",
      action: "BUY",
      entryLow: 1000,
      entryHigh: 1050,
      stopLoss: 950,
      targets: [{ price: 1200, isOpenEnded: false }],
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([
              {
                id: "appr-1",
                symbol: "AXISBANK-EQ",
                parsedJson,
                suggestedQty: 10,
                status: "pending",
                slackTs: "ts-001",
                createdAt: "2026-01-01T00:00:00.000Z",
                resolvedAt: null,
              },
            ]),
          }),
        }),
      }),
    });

    const result = queryApprovals() as Array<{ parsedInstruction: { stockName: string } }>;
    expect(result[0]?.parsedInstruction?.stockName).toBe("Axis Bank");
  });

  it("sets parsedInstruction to null for invalid JSON", () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([
              {
                id: "appr-2",
                symbol: "X",
                parsedJson: "not-json",
                suggestedQty: 1,
                status: "pending",
                slackTs: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                resolvedAt: null,
              },
            ]),
          }),
        }),
      }),
    });

    const result = queryApprovals() as Array<{ parsedInstruction: unknown }>;
    expect(result[0]?.parsedInstruction).toBeNull();
  });
});

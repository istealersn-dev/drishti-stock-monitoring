import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbTransaction,
  mockIsDryRunActive,
  mockCancelGTT,
  mockGetCachedHoldings,
  mockFetchMargins,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockIsDryRunActive: vi.fn().mockReturnValue(false),
  mockCancelGTT: vi.fn(),
  mockGetCachedHoldings: vi.fn().mockReturnValue({ holdings: [], cachedAt: null }),
  mockFetchMargins: vi.fn(),
}));

vi.mock("../db/db.js", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}));
vi.mock("../shared/dryRun.js", () => ({ isDryRunActive: mockIsDryRunActive }));
vi.mock("../db/schema.js", () => ({
  agentRuns: {},
  agentLogs: {},
  gttOrders: {},
  pendingApprovals: {},
  agentSettings: {},
  brokerConnections: { brokerId: "broker_id" },
}));
vi.mock("../shared/env.js", () => ({
  env: {
    DRISHTI_DRY_RUN: false,
    DRISHTI_POLL_INTERVAL_MINUTES: 5,
    DRISHTI_MARKET_OPEN: "09:15",
    DRISHTI_MARKET_CLOSE: "15:30",
    DRISHTI_APPROVAL_TIMEOUT_MINUTES: 10,
    AGENT_API_PORT: 4000,
    DRISHTI_ACCESS_KEY: "test-key",
  },
}));
vi.mock("../features/portfolio/portfolio.cache.js", () => ({
  getCachedHoldings: mockGetCachedHoldings,
}));
vi.mock("../features/gtt/gtt.tools.js", () => ({ cancelGTT: mockCancelGTT }));
vi.mock("../features/portfolio/portfolio.tools.js", () => ({ fetchMargins: mockFetchMargins }));
vi.mock("../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BrokerError, UpstoxError } from "../shared/errors.js";

import {
  buildApiApp,
  healthErrorCode,
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

describe("DELETE /api/gtt/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockRow = (overrides: Record<string, unknown> = {}): void => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({
            id: "gtt-1",
            symbol: "AXISBANK-EQ",
            status: "active",
            upstoxOrderId: "upstox-order-1",
            ...overrides,
          }),
        }),
      }),
    });
  };

  const inject = (app: Awaited<ReturnType<typeof buildApiApp>>): ReturnType<typeof app.inject> =>
    app.inject({
      method: "DELETE",
      url: "/api/gtt/gtt-1",
      headers: { "x-access-key": "test-key" },
    });

  it("returns 404 when the GTT row does not exist", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
      }),
    });
    const app = await buildApiApp();
    const response = await inject(app);
    expect(response.statusCode).toBe(404);
  });

  it("returns 409 when the row is already cancelled", async () => {
    mockRow({ status: "cancelled" });
    const app = await buildApiApp();
    const response = await inject(app);
    expect(response.statusCode).toBe(409);
  });

  it("live mode, no Upstox order ID on record: returns 422 and logs the failure without marking cancelled", async () => {
    mockIsDryRunActive.mockReturnValue(false);
    mockRow({ upstoxOrderId: null });
    const insertValues = vi.fn().mockReturnValue({ run: vi.fn() });
    mockDbInsert.mockReturnValue({ values: insertValues });

    const app = await buildApiApp();
    const response = await inject(app);

    expect(response.statusCode).toBe(422);
    expect(mockCancelGTT).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: "gtt_cancel_failed" }),
    );
  });

  it("live mode, Upstox cancel succeeds: marks the row cancelled", async () => {
    mockIsDryRunActive.mockReturnValue(false);
    mockRow();
    mockCancelGTT.mockResolvedValue({ ok: true, value: "upstox-order-1" });
    const updateRun = vi.fn();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: updateRun }) }),
    });

    const app = await buildApiApp();
    const response = await inject(app);

    expect(mockCancelGTT).toHaveBeenCalledWith("upstox-order-1", false);
    expect(updateRun).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it("live mode, Upstox cancel fails: returns 502 and logs the failure without marking cancelled", async () => {
    mockIsDryRunActive.mockReturnValue(false);
    mockRow();
    mockCancelGTT.mockResolvedValue({ ok: false, error: { message: "Upstox timeout" } });
    const insertValues = vi.fn().mockReturnValue({ run: vi.fn() });
    mockDbInsert.mockReturnValue({ values: insertValues });

    const app = await buildApiApp();
    const response = await inject(app);

    expect(response.statusCode).toBe(502);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: "gtt_cancel_failed", error: "Upstox timeout" }),
    );
  });

  it("dry-run: marks the row cancelled without calling Upstox", async () => {
    mockIsDryRunActive.mockReturnValue(true);
    mockRow();
    const updateRun = vi.fn();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: updateRun }) }),
    });

    const app = await buildApiApp();
    const response = await inject(app);

    expect(mockCancelGTT).not.toHaveBeenCalled();
    expect(updateRun).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });
});

describe("GET /api/holdings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("translates cached broker-agnostic holdings back to the UI's snake_case wire shape", async () => {
    mockGetCachedHoldings.mockReturnValue({
      holdings: [
        {
          isin: "INE002A01018",
          tradingSymbol: "RELIANCE",
          companyName: "Reliance Industries Ltd",
          quantity: 10,
          averagePrice: 2800,
          lastPrice: 2900,
          closePrice: 2880,
          pnl: 1000,
          dayChange: 20,
          dayChangePercentage: 0.69,
          instrumentToken: "NSE_EQ|INE002A01018",
          exchange: "NSE",
          product: "CNC",
        },
      ],
      cachedAt: "2026-01-01T00:00:00.000Z",
    });

    const app = await buildApiApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/holdings",
      headers: { "x-access-key": "test-key" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: Record<string, unknown>[] };
    expect(body.data[0]).toEqual({
      isin: "INE002A01018",
      trading_symbol: "RELIANCE",
      company_name: "Reliance Industries Ltd",
      quantity: 10,
      average_price: 2800,
      last_price: 2900,
      close_price: 2880,
      pnl: 1000,
      day_change: 20,
      day_change_percentage: 0.69,
      product: "CNC",
      exchange: "NSE",
      instrument_token: "NSE_EQ|INE002A01018",
    });
  });
});

describe("GET /api/brokers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills in a not_configured row for every known broker with no DB row yet", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
    });

    const app = await buildApiApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/brokers",
      headers: { "x-access-key": "test-key" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { brokerId: string; status: string }[] };
    expect(body.data).toEqual([
      {
        brokerId: "upstox",
        isActive: false,
        status: "not_configured",
        lastCheckedAt: null,
        lastError: null,
      },
      {
        brokerId: "groww",
        isActive: false,
        status: "not_configured",
        lastCheckedAt: null,
        lastError: null,
      },
    ]);
  });

  it("uses the real row for a broker that has been verified or activated", async () => {
    const row = {
      brokerId: "upstox",
      isActive: true,
      status: "connected",
      lastCheckedAt: "2026-01-01T00:00:00.000Z",
      lastError: null,
    };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([row]) }),
    });

    const app = await buildApiApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/brokers",
      headers: { "x-access-key": "test-key" },
    });

    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(body.data).toContainEqual(row);
  });
});

describe("POST /api/brokers/:id/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  const inject = (
    app: Awaited<ReturnType<typeof buildApiApp>>,
    id: string,
  ): ReturnType<typeof app.inject> =>
    app.inject({
      method: "POST",
      url: `/api/brokers/${id}/verify`,
      headers: { "x-access-key": "test-key" },
    });

  it("returns 400 for an unknown broker id", async () => {
    const app = await buildApiApp();
    const response = await inject(app, "not-a-broker");
    expect(response.statusCode).toBe(400);
  });

  it("returns 501 for a known but unimplemented broker (groww) without calling fetchMargins", async () => {
    const app = await buildApiApp();
    const response = await inject(app, "groww");
    expect(response.statusCode).toBe(501);
    expect(mockFetchMargins).not.toHaveBeenCalled();
  });

  it("records status=connected on a successful live read", async () => {
    mockFetchMargins.mockResolvedValue({ ok: true, value: { available_margin: 50000 } });
    const insertValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({ run: vi.fn() }),
    });
    mockDbInsert.mockReturnValue({ values: insertValues });

    const app = await buildApiApp();
    const response = await inject(app, "upstox");

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, data: { status: "connected" } });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "connected" }));
  });

  it("records status=error with the failure message on a failed live read", async () => {
    mockFetchMargins.mockResolvedValue({ ok: false, error: { message: "Upstox token expired" } });
    const insertValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({ run: vi.fn() }),
    });
    mockDbInsert.mockReturnValue({ values: insertValues });

    const app = await buildApiApp();
    const response = await inject(app, "upstox");

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: { status: "error", error: "Upstox token expired" },
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", lastError: "Upstox token expired" }),
    );
  });
});

describe("POST /api/brokers/:id/activate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an unknown broker id", async () => {
    const app = await buildApiApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/brokers/not-a-broker/activate",
      headers: { "x-access-key": "test-key" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("activates a known, implemented broker via setActiveBroker's transaction", async () => {
    type TxMock = { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    const tx: TxMock = {
      insert: vi.fn().mockReturnValue({
        values: vi
          .fn()
          .mockReturnValue({ onConflictDoUpdate: vi.fn().mockReturnValue({ run: vi.fn() }) }),
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ run: vi.fn() }) }),
    };
    mockDbTransaction.mockImplementation((fn: (tx: TxMock) => void) => fn(tx));

    const app = await buildApiApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/brokers/upstox/activate",
      headers: { "x-access-key": "test-key" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(mockDbTransaction).toHaveBeenCalledOnce();
  });

  it("returns 501 for a known but unimplemented broker (groww) without touching the DB", async () => {
    const app = await buildApiApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/brokers/groww/activate",
      headers: { "x-access-key": "test-key" },
    });

    expect(response.statusCode).toBe(501);
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });
});

describe("healthErrorCode", () => {
  it("tags a broker 401 as BROKER_UNAUTHORIZED", () => {
    expect(healthErrorCode(new BrokerError("Unauthorized", "upstox", 401))).toBe(
      "BROKER_UNAUTHORIZED",
    );
    expect(healthErrorCode(new UpstoxError("Holdings request failed: Unauthorized", 401))).toBe(
      "BROKER_UNAUTHORIZED",
    );
  });

  it("returns undefined for a broker error with a non-401 status", () => {
    expect(healthErrorCode(new BrokerError("Server error", "upstox", 500))).toBeUndefined();
    expect(healthErrorCode(new BrokerError("No status", "upstox"))).toBeUndefined();
  });

  it("returns undefined for a non-broker error (e.g. LLM failure)", () => {
    expect(healthErrorCode(new Error("LLM narrative failed"))).toBeUndefined();
  });
});

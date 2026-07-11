import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockFetchHoldings,
  mockFetchLTP,
  mockPushAlert,
  mockDetectBreaches,
  mockHandleSlBreach,
  mockAnalysePortfolio,
  mockDbInsert,
  mockDbUpdate,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockFetchHoldings: vi.fn(),
  mockFetchLTP: vi.fn(),
  mockPushAlert: vi.fn(),
  mockDetectBreaches: vi.fn(),
  mockHandleSlBreach: vi.fn(),
  mockAnalysePortfolio: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: mockFetchHoldings,
  fetchLTP: mockFetchLTP,
}));
vi.mock("../alerts/alerts.slack.js", () => ({ pushAlert: mockPushAlert }));
vi.mock("../stopLoss/stopLoss.detector.js", () => ({ detectBreaches: mockDetectBreaches }));
vi.mock("../stopLoss/stopLoss.handler.js", () => ({ handleSlBreach: mockHandleSlBreach }));
vi.mock("../stopLoss/stopLoss.config.js", () => ({ loadSlConfigs: vi.fn().mockReturnValue([]) }));
vi.mock("../targets/targets.detector.js", () => ({
  loadTargetConfigs: vi.fn().mockReturnValue([]),
  detectTargetHits: vi.fn().mockReturnValue([]),
}));
vi.mock("../insights/insights.chain.js", () => ({ analysePortfolio: mockAnalysePortfolio }));
vi.mock("../../scheduler/cron.js", () => ({ isMarketOpen: vi.fn().mockReturnValue(true) }));
vi.mock("../../shared/env.js", () => ({
  env: { DRISHTI_DRY_RUN: false, DRISHTI_LLM_MOVE_THRESHOLD_PCT: 4 },
}));
vi.mock("../../db/db.js", () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
    select: mockDbSelect,
  },
}));
vi.mock("../../db/schema.js", () => ({
  agentLogs: {},
  gttOrders: {},
  agentSettings: { key: "key", value: "value" },
}));

import { agentSettings, gttOrders } from "../../db/schema.js";
import { UpstoxError } from "../../shared/errors.js";
import { __resetAnalysisSnapshotForTests } from "../insights/insights.cache.js";

import { buildAgentGraph } from "./agent.graph.js";
import type { AgentState } from "./agent.state.js";

const makeInitialState = (): AgentState => ({
  runId: "run-test-001",
  holdings: [],
  ltpMap: {},
  slConfigs: [],
  breaches: [],
  targetHits: [],
  llmOutput: null,
  errors: [],
});

const mockHolding = {
  isin: "INE001",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank",
  quantity: 10,
  average_price: 1000,
  last_price: 1100,
  close_price: 1090,
  pnl: 1000,
  day_change: 10,
  day_change_percentage: 0.9,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
};

describe("buildAgentGraph", () => {
  let mockDatabaseInsertValues: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetAnalysisSnapshotForTests();
    const innerRun = vi.fn();
    const innerAll = vi.fn().mockReturnValue([]);
    mockDatabaseInsertValues = vi.fn().mockReturnValue({
      run: innerRun,
      onConflictDoUpdate: vi.fn().mockReturnValue({ run: innerRun }),
    });
    mockDbInsert.mockReturnValue({ values: mockDatabaseInsertValues });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: innerRun }) }),
    });
    const innerGet = vi.fn().mockReturnValue(undefined); // wasRecentlyAlerted: no prior row by default
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ all: innerAll, get: innerGet }),
      }),
    });
    mockPushAlert.mockResolvedValue({ ok: true, value: "ts-001" });
    mockHandleSlBreach.mockResolvedValue(undefined);
    mockDetectBreaches.mockReturnValue([]);
  });

  it("handles empty portfolio — skips all subsequent nodes gracefully", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [] });
    const graph = buildAgentGraph();
    const final = await graph.run(makeInitialState());
    expect(final.holdings).toHaveLength(0);
    expect(mockAnalysePortfolio).not.toHaveBeenCalled();
  });

  it("appends error and skips analysis when holdings fetch fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: false, error: new Error("network error") });
    const graph = buildAgentGraph();
    const final = await graph.run(makeInitialState());
    expect(final.errors).toHaveLength(1);
    expect(final.errors[0]).toContain("fetch_holdings");
    expect(mockAnalysePortfolio).not.toHaveBeenCalled();
  });

  describe("upstox auth-failure alert", () => {
    it("pushes a token alert and writes a dedup row when holdings fetch 401s", async () => {
      mockFetchHoldings.mockResolvedValue({
        ok: false,
        error: new UpstoxError("Holdings request failed: Unauthorized", 401),
      });
      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("Upstox token rejected"));
      expect(mockDatabaseInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ action: "upstox_auth_failure", symbol: "__portfolio__" }),
      );
    });

    it("does not alert on a non-401 holdings failure", async () => {
      mockFetchHoldings.mockResolvedValue({
        ok: false,
        error: new UpstoxError("Holdings request failed: Bad Gateway", 502),
      });
      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockPushAlert).not.toHaveBeenCalled();
    });

    it("suppresses the alert within the cooldown window", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
            get: vi.fn().mockReturnValue({ id: 1 }), // wasRecentlyAlerted: prior row exists
          }),
        }),
      });
      mockFetchHoldings.mockResolvedValue({
        ok: false,
        error: new UpstoxError("Holdings request failed: Unauthorized", 401),
      });
      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockPushAlert).not.toHaveBeenCalled();
    });

    it("does not write the dedup row when the Slack push fails, so the next tick retries", async () => {
      mockPushAlert.mockResolvedValue({ ok: false, error: new Error("slack down") });
      mockFetchHoldings.mockResolvedValue({
        ok: false,
        error: new UpstoxError("Holdings request failed: Unauthorized", 401),
      });
      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockPushAlert).toHaveBeenCalledOnce();
      expect(mockDatabaseInsertValues).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "upstox_auth_failure" }),
      );
    });
  });

  it("runs full pipeline and returns LLM output on success", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": {
          last_price: 1100,
          instrument_token: "NSE_EQ|INE238A01034",
        } as const,
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [
          { symbol: "AXISBANK-EQ", action: "hold", reasoning: "Looks fine.", gttParams: null },
        ],
        portfolioSummary: "All good.",
      },
    });

    const graph = buildAgentGraph();
    const final = await graph.run(makeInitialState());

    expect(final.holdings).toHaveLength(1);
    expect(final.llmOutput?.portfolioSummary).toBe("All good.");
    // Portfolio summary is pushed to Slack once per trading session
    expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("All good."));
  });

  it("continues without LLM output when analysePortfolio fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": {
          last_price: 1100,
          instrument_token: "NSE_EQ|INE238A01034",
        } as const,
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: false,
      error: new Error("LM Studio unreachable"),
    });

    const graph = buildAgentGraph();
    const final = await graph.run(makeInitialState());

    // LLM failure → null output so logAndAlertNode stays silent (no Slack spam)
    expect(final.llmOutput).toBeNull();
    expect(final.errors).toHaveLength(0);
  });

  it("retries analysePortfolio on the very next tick after a failure, instead of going silent for the rest of the trading day", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValueOnce({ ok: false, error: new Error("LLM outage") });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledOnce();

    // No breach/target/price-move on the second tick either — only the once-a-day
    // fallback should be driving this call. Because the first attempt failed, no
    // llm_analyse_gate row was written, so fallbackDue must still be true.
    mockAnalysePortfolio.mockResolvedValueOnce({
      ok: true,
      value: { decisions: [], portfolioSummary: "Recovered." },
    });
    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledTimes(2);
  });

  it("skips LLM analysis when market is closed", async () => {
    const { isMarketOpen } = await import("../../scheduler/cron.js");
    vi.mocked(isMarketOpen).mockReturnValueOnce(false);

    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });

    const graph = buildAgentGraph();
    const final = await graph.run(makeInitialState());

    expect(mockAnalysePortfolio).not.toHaveBeenCalled();
    expect(final.llmOutput).toBeNull();
  });

  it("pushes alert_only decision to Slack and writes dedup log row", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [
          {
            symbol: "AXISBANK-EQ",
            action: "alert_only",
            reasoning: "Watch this.",
            gttParams: null,
          },
        ],
        portfolioSummary: "Watch.",
      },
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("Watch this."));
  });

  it("suppresses alert_only when wasRecentlyAlerted returns a row", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [
          {
            symbol: "AXISBANK-EQ",
            action: "alert_only",
            reasoning: "Watch this.",
            gttParams: null,
          },
        ],
        portfolioSummary: "Watch.",
      },
    });
    // Simulate wasRecentlyAlerted returning a row (already alerted this hour)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue({ id: 1 }),
        }),
      }),
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    expect(mockPushAlert).not.toHaveBeenCalledWith(expect.stringContaining("Watch this."));
  });

  it("does not write dedup log row when alert_only Slack push fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [
          {
            symbol: "AXISBANK-EQ",
            action: "alert_only",
            reasoning: "Watch this.",
            gttParams: null,
          },
        ],
        portfolioSummary: "Watch.",
      },
    });
    mockPushAlert.mockResolvedValue({ ok: false, error: new Error("Slack rate limit") });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    // No dedup row — the alert failed so the next tick should retry.
    // Inspect the .values() mock (not db.insert() itself, which only receives the table arg).
    const writtenActions = mockDatabaseInsertValues.mock.calls.map(
      (call: unknown[]) => (call[0] as { action?: string } | undefined)?.action,
    );
    expect(writtenActions).not.toContain("alert_only");
  });

  it("suppresses portfolio_summary Slack push when already sent this session", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [{ symbol: "AXISBANK-EQ", action: "hold", reasoning: "Fine.", gttParams: null }],
        portfolioSummary: "Summary.",
      },
    });
    // Simulate wasRecentlyAlerted returning a row for portfolio_summary
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue({ id: 1 }),
        }),
      }),
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    expect(mockPushAlert).not.toHaveBeenCalledWith(expect.stringContaining("Portfolio Update"));
  });

  it("does not write portfolio_summary dedup row when logAndAlert Slack push fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [{ symbol: "AXISBANK-EQ", action: "hold", reasoning: "Fine.", gttParams: null }],
        portfolioSummary: "Summary.",
      },
    });
    mockPushAlert.mockResolvedValue({ ok: false, error: new Error("Slack down") });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    const writtenActions = mockDatabaseInsertValues.mock.calls.map(
      (call: unknown[]) => (call[0] as { action?: string } | undefined)?.action,
    );
    expect(writtenActions).not.toContain("portfolio_summary");
  });

  it("writes gtt_modify_failed row when gtt_modify decision has null gttParams", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [
          { symbol: "AXISBANK-EQ", action: "gtt_modify", reasoning: "Adjust SL.", gttParams: null },
        ],
        portfolioSummary: "Adjust needed.",
      },
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    const writtenActions = mockDatabaseInsertValues.mock.calls.map(
      (call: unknown[]) => (call[0] as { action?: string } | undefined)?.action,
    );
    expect(writtenActions).toContain("gtt_modify_failed");
    expect(mockPushAlert).not.toHaveBeenCalledWith(expect.stringContaining("Adjust SL."));
  });

  describe("gtt_cancel", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // db.select() is shared across unrelated queries in one graph run (wasRecentlyAlerted,
    // findActiveGtt, isDryRunActive) — discriminate by the table passed to .from() so
    // setting up the dry-run/active-GTT state for this test doesn't corrupt the other
    // queries the graph makes along the way.
    const mockSelectByTable = (dryRunValue: string | undefined): void => {
      mockDbSelect.mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === gttOrders) {
            return {
              where: vi.fn().mockReturnValue({
                all: vi
                  .fn()
                  .mockReturnValue([{ id: "gtt-existing-id", upstoxOrderId: "gtt-existing-id" }]),
              }),
            };
          }
          if (table === agentSettings) {
            return {
              where: vi.fn().mockReturnValue({
                get: vi
                  .fn()
                  .mockReturnValue(
                    dryRunValue === undefined ? undefined : { key: "dry_run", value: dryRunValue },
                  ),
              }),
            };
          }
          // agentLogs (wasRecentlyAlerted) — not alerted yet by default.
          return { where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }) };
        }),
      }));
    };

    it("dry-run: does not mark the GTT row cancelled, since no real Upstox cancel happened", async () => {
      mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
      mockFetchLTP.mockResolvedValue({
        ok: true,
        value: {
          "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
        },
      });
      mockAnalysePortfolio.mockResolvedValue({
        ok: true,
        value: {
          decisions: [
            { symbol: "AXISBANK-EQ", action: "gtt_cancel", reasoning: "No longer needed." },
          ],
          portfolioSummary: "x",
        },
      });
      mockSelectByTable("true");

      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockDbUpdate).not.toHaveBeenCalled();
      const writtenActions = mockDatabaseInsertValues.mock.calls.map(
        (call: unknown[]) => (call[0] as { action?: string } | undefined)?.action,
      );
      expect(writtenActions).toContain("gtt_cancel");
    });

    it("real cancel: marks the GTT row cancelled once Upstox confirms", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ status: "success", data: { order_id: "gtt-existing-id" } }),
        }),
      );
      mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
      mockFetchLTP.mockResolvedValue({
        ok: true,
        value: {
          "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
        },
      });
      mockAnalysePortfolio.mockResolvedValue({
        ok: true,
        value: {
          decisions: [
            { symbol: "AXISBANK-EQ", action: "gtt_cancel", reasoning: "No longer needed." },
          ],
          portfolioSummary: "x",
        },
      });
      mockSelectByTable("false");

      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockDbUpdate).toHaveBeenCalledOnce();
    });

    it("live mode, row has no Upstox order ID: refuses to cancel remotely and logs the failure", async () => {
      mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
      mockFetchLTP.mockResolvedValue({
        ok: true,
        value: {
          "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
        },
      });
      mockAnalysePortfolio.mockResolvedValue({
        ok: true,
        value: {
          decisions: [
            { symbol: "AXISBANK-EQ", action: "gtt_cancel", reasoning: "No longer needed." },
          ],
          portfolioSummary: "x",
        },
      });
      mockDbSelect.mockImplementation(() => ({
        from: vi.fn((table: unknown) => {
          if (table === gttOrders) {
            return {
              where: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue([{ id: "gtt-existing-id", upstoxOrderId: null }]),
              }),
            };
          }
          if (table === agentSettings) {
            return {
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockReturnValue({ key: "dry_run", value: "false" }),
              }),
            };
          }
          return { where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }) };
        }),
      }));

      const graph = buildAgentGraph();
      await graph.run(makeInitialState());

      expect(mockDbUpdate).not.toHaveBeenCalled();
      const writtenLogs = mockDatabaseInsertValues.mock.calls.map(
        (call: unknown[]) => call[0] as { action?: string; error?: string },
      );
      expect(writtenLogs).toContainEqual(
        expect.objectContaining({
          action: "gtt_cancel",
          error: "Active GTT row has no Upstox order ID — cannot cancel remotely",
        }),
      );
    });
  });

  it("skips the LLM call on a repeat tick with no material change once the fallback gate has fired", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [{ symbol: "AXISBANK-EQ", action: "hold", reasoning: "Fine.", gttParams: null }],
        portfolioSummary: "Summary.",
      },
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledOnce();

    // Second tick: same LTP (no significant move), and wasRecentlyAlerted now
    // reports the llm_analyse_gate row written by the first tick, so the
    // fallback cadence is satisfied too — the LLM should not be called again.
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue({ id: 1 }),
        }),
      }),
    });

    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledOnce();
  });

  it("calls the LLM again when a holding moves beyond the threshold, even with the fallback gate satisfied", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: {
        decisions: [{ symbol: "AXISBANK-EQ", action: "hold", reasoning: "Fine.", gttParams: null }],
        portfolioSummary: "Summary.",
      },
    });

    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1100, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    const graph = buildAgentGraph();
    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledOnce();

    // Fallback gate already satisfied (llm_analyse_gate row exists), but LTP
    // has moved >4% since the last analysis — should still trigger a call.
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue({ id: 1 }),
        }),
      }),
    });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 1200, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });

    await graph.run(makeInitialState());
    expect(mockAnalysePortfolio).toHaveBeenCalledTimes(2);
  });

  it("calls handleSlBreach for each detected breach", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [mockHolding] });
    mockFetchLTP.mockResolvedValue({
      ok: true,
      value: {
        "NSE_EQ|INE238A01034": { last_price: 900, instrument_token: "NSE_EQ|INE238A01034" },
      },
    });
    mockDetectBreaches.mockReturnValue([{ holding: mockHolding, ltp: 900, slThreshold: 950 }]);
    mockAnalysePortfolio.mockResolvedValue({
      ok: true,
      value: { decisions: [], portfolioSummary: "SL breached." },
    });

    const graph = buildAgentGraph();
    await graph.run(makeInitialState());

    expect(mockHandleSlBreach).toHaveBeenCalledOnce();
  });
});

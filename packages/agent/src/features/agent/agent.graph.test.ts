import { describe, it, expect, vi, beforeEach } from "vitest";

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
vi.mock("../../shared/env.js", () => ({ env: { DRISHTI_DRY_RUN: false } }));
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
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    const innerRun = vi.fn();
    const innerAll = vi.fn().mockReturnValue([]);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockReturnValue({ run: innerRun }) });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: innerRun }) }),
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ all: innerAll }) }),
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
    // Portfolio summary is logged to DB only — Slack push is the digest's responsibility
    expect(mockPushAlert).not.toHaveBeenCalledWith(expect.stringContaining("All good."));
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

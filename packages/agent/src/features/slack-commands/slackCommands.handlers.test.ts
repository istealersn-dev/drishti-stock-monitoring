import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchHoldings: vi.fn(),
}));

vi.mock("../gtt/gtt.tools.js", () => ({
  listGTTs: vi.fn(),
}));

vi.mock("../../llm/geminiClient.js", () => ({
  generateText: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined),
          limit: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
        }),
        where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ run: vi.fn() }) }),
  },
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    DRISHTI_DRY_RUN: false,
    DRISHTI_POLL_INTERVAL_MINUTES: 5,
  },
}));

import { generateText } from "../../llm/geminiClient.js";
import { listGTTs } from "../gtt/gtt.tools.js";
import type { Holding } from "../portfolio/portfolio.schema.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";

import {
  handleAnalyse,
  handleGtts,
  handleHoldings,
  handlePnl,
  handleStatus,
} from "./slackCommands.handlers.js";

const mockFetchHoldings = vi.mocked(fetchHoldings);
const mockListGTTs = vi.mocked(listGTTs);
const mockGenerateText = vi.mocked(generateText);

const makeHolding = (): Holding => ({
  isin: "INE123A01010",
  trading_symbol: "RELIANCE-EQ",
  company_name: "Reliance Industries",
  quantity: 10,
  average_price: 2800,
  last_price: 2900,
  close_price: 2890,
  pnl: 1000,
  day_change: 10,
  day_change_percentage: 0.35,
  instrument_token: "NSE_EQ|INE123A01010",
  exchange: "NSE",
  product: "CNC",
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── handleStatus ─────────────────────────────────────────────────────────────

describe("handleStatus", () => {
  it("sends status message with no-runs state when agentRuns is empty", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    await handleStatus(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Drishti Status"));
    expect(say).toHaveBeenCalledWith(expect.stringContaining("No runs recorded yet"));
  });

  it("sends status message with last run details when a row exists", async () => {
    const { db } = await import("../../db/db.js");
    vi.mocked(db.select().from(expect.anything()).orderBy(expect.anything()).get).mockReturnValue({
      startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      status: "completed",
      summary: "5 holdings, 0 SL breaches",
    } as never);
    const say = vi.fn().mockResolvedValue(undefined);
    await handleStatus(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Drishti Status"));
  });
});

// ── handlePnl ────────────────────────────────────────────────────────────────

describe("handlePnl", () => {
  it("sends error message and logs when fetchHoldings fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: false, error: new Error("Unauthorized") });
    const say = vi.fn().mockResolvedValue(undefined);
    await handlePnl(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Could not fetch holdings"));
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Unauthorized"));
  });

  it("sends formatted P&L when holdings are returned", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [makeHolding()] });
    const say = vi.fn().mockResolvedValue(undefined);
    await handlePnl(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Portfolio P&L"));
  });
});

// ── handleHoldings ───────────────────────────────────────────────────────────

describe("handleHoldings", () => {
  it("sends error message when fetchHoldings fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: false, error: new Error("Network error") });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleHoldings(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Could not fetch holdings"));
  });

  it("sends holdings table on success", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [makeHolding()] });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleHoldings(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("RELIANCE-EQ"));
  });
});

// ── handleGtts ───────────────────────────────────────────────────────────────

describe("handleGtts", () => {
  it("sends error message when listGTTs fails", async () => {
    mockListGTTs.mockResolvedValue({ ok: false, error: new Error("API error") });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleGtts(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Could not fetch GTTs"));
  });

  it("sends GTT list on success", async () => {
    mockListGTTs.mockResolvedValue({ ok: true, value: [] });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleGtts(say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("No GTT orders found"));
  });
});

// ── handleAnalyse ─────────────────────────────────────────────────────────────

describe("handleAnalyse", () => {
  it("sends no-match message when query does not match any holding", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [makeHolding()] });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleAnalyse("WIPRO", say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("No holding matched"));
  });

  it("sends error message when fetchHoldings fails", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: false, error: new Error("Unauthorized") });
    const say = vi.fn().mockResolvedValue(undefined);
    await handleAnalyse("RELIANCE", say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Could not fetch holdings"));
  });

  it("sends analysis result on LLM success", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [makeHolding()] });
    mockGenerateText.mockResolvedValue("Hold. Trading at +3.5% above entry, well above SL.");
    const say = vi.fn().mockResolvedValue(undefined);
    await handleAnalyse("reliance", say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Analysing"));
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Hold."));
  });

  it("sends LLM error message when chat throws", async () => {
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [makeHolding()] });
    mockGenerateText.mockRejectedValue(new Error("LM Studio not running"));
    const say = vi.fn().mockResolvedValue(undefined);
    await handleAnalyse("reliance", say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("Analysis failed"));
    expect(say).toHaveBeenCalledWith(expect.stringContaining("LM Studio not running"));
  });

  it("prefers exact symbol match over substring company name match", async () => {
    const hdfcBank = { ...makeHolding(), trading_symbol: "HDFCBANK-EQ", company_name: "HDFC Bank" };
    const hdfcLife = { ...makeHolding(), trading_symbol: "HDFCLIFE-EQ", company_name: "HDFC Life" };
    mockFetchHoldings.mockResolvedValue({ ok: true, value: [hdfcLife, hdfcBank] });
    mockGenerateText.mockResolvedValue("Hold.");
    const say = vi.fn().mockResolvedValue(undefined);
    await handleAnalyse("HDFCBANK-EQ", say);
    expect(say).toHaveBeenCalledWith(expect.stringContaining("HDFCBANK-EQ"));
  });
});

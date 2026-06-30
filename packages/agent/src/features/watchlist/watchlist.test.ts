import { describe, it, expect, vi, beforeEach } from "vitest";

import { ok, err, UpstoxError } from "../../shared/errors.js";
import type { LtpData } from "../portfolio/portfolio.schema.js";

const { mockInsertRun, mockDeleteRun, mockSelectAll, mockWhere, mockFetchLTP } = vi.hoisted(() => ({
  mockInsertRun: vi.fn(),
  mockDeleteRun: vi.fn(),
  mockSelectAll: vi.fn(),
  mockWhere: vi.fn(),
  mockFetchLTP: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ run: mockInsertRun }),
    }),
    delete: vi.fn().mockReturnValue({ where: mockWhere }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ all: mockSelectAll }),
    }),
  },
}));

vi.mock("../../db/schema.js", () => ({
  watchlist: { symbol: "symbol" },
}));

vi.mock("../portfolio/portfolio.tools.js", () => ({
  fetchLTP: mockFetchLTP,
}));

import { checkProximity } from "./watchlist.monitor.js";
import type { WatchlistEntry } from "./watchlist.schema.js";
import { addToWatchlist, removeFromWatchlist, getWatchlist } from "./watchlist.service.js";

const makeEntry = (overrides: Partial<WatchlistEntry> = {}): WatchlistEntry => ({
  symbol: "RELIANCE",
  displayName: "Reliance Industries",
  notes: null,
  addedAt: "2026-06-29T00:00:00.000Z",
  ...overrides,
});

describe("watchlist.service", () => {
  beforeEach(() => {
    mockInsertRun.mockReset();
    mockDeleteRun.mockReset();
    mockSelectAll.mockReset();
    mockWhere.mockReset();
    mockWhere.mockReturnValue({ run: mockDeleteRun });
  });

  it("addToWatchlist inserts a row", () => {
    const result = addToWatchlist("RELIANCE", "Reliance Industries", "near 200 DMA");
    expect(result.ok).toBe(true);
    expect(mockInsertRun).toHaveBeenCalledOnce();
  });

  it("addToWatchlist returns err on duplicate", () => {
    mockInsertRun.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: watchlist.symbol");
    });
    const result = addToWatchlist("RELIANCE", "Reliance Industries");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("already in watchlist");
  });

  it("removeFromWatchlist deletes by symbol", () => {
    const result = removeFromWatchlist("RELIANCE");
    expect(result.ok).toBe(true);
    expect(mockDeleteRun).toHaveBeenCalledOnce();
  });

  it("getWatchlist returns all entries", () => {
    mockSelectAll.mockReturnValue([makeEntry()]);
    const entries = getWatchlist();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.symbol).toBe("RELIANCE");
  });
});

describe("checkProximity", () => {
  beforeEach(() => {
    mockFetchLTP.mockReset();
  });

  const RELIANCE_KEY = "NSE_EQ|INE002A01018";
  const keyMap = { RELIANCE: RELIANCE_KEY };

  it("returns an alert when the LTP is within 2% of dma200", async () => {
    const ltpMap: Record<string, LtpData> = {
      [RELIANCE_KEY]: { last_price: 1010, instrument_token: RELIANCE_KEY },
    };
    mockFetchLTP.mockResolvedValue(ok(ltpMap));
    const alerts = await checkProximity([makeEntry()], { RELIANCE: { dma200: 1000 } }, keyMap);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.distancePct).toBe(1);
  });

  it("returns no alert when the LTP is more than 2% from dma200", async () => {
    const ltpMap: Record<string, LtpData> = {
      [RELIANCE_KEY]: { last_price: 1100, instrument_token: RELIANCE_KEY },
    };
    mockFetchLTP.mockResolvedValue(ok(ltpMap));
    const alerts = await checkProximity([makeEntry()], { RELIANCE: { dma200: 1000 } }, keyMap);
    expect(alerts).toHaveLength(0);
  });

  it("skips entries when dma200 is null", async () => {
    const alerts = await checkProximity([makeEntry()], { RELIANCE: { dma200: null } }, keyMap);
    expect(alerts).toHaveLength(0);
    expect(mockFetchLTP).not.toHaveBeenCalled();
  });

  it("skips a symbol when its LTP is missing from the response", async () => {
    mockFetchLTP.mockResolvedValue(ok({}));
    const alerts = await checkProximity([makeEntry()], { RELIANCE: { dma200: 1000 } }, keyMap);
    expect(alerts).toHaveLength(0);
  });

  it("returns no alerts when the LTP batch fetch fails", async () => {
    mockFetchLTP.mockResolvedValue(err(new UpstoxError("network down")));
    const alerts = await checkProximity([makeEntry()], { RELIANCE: { dma200: 1000 } }, keyMap);
    expect(alerts).toHaveLength(0);
  });
});

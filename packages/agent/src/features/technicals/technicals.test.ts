import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../shared/env.js", () => ({
  env: { UPSTOX_EXTENDED_TOKEN: "test-token" },
}));

const { mockAll } = vi.hoisted(() => ({ mockAll: vi.fn() }));

vi.mock("../../db/db.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ all: mockAll }),
        }),
      }),
    }),
  },
}));

vi.mock("../../db/schema.js", () => ({
  technicalLevels: { symbol: "symbol", date: "date" },
}));

import { getCachedLevels } from "./technicals.cache.js";
import type { OHLCVBar } from "./technicals.schema.js";
import { computeLevels, fetchOHLCV } from "./technicals.service.js";

const makeBar = (overrides: Partial<OHLCVBar> = {}): OHLCVBar => ({
  timestamp: "2026-06-01T00:00:00+05:30",
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 1000,
  ...overrides,
});

const makeBars = (count: number, fn: (index: number) => Partial<OHLCVBar>): OHLCVBar[] =>
  Array.from({ length: count }, (_, index) => makeBar(fn(index)));

describe("computeLevels", () => {
  it("returns null dma200 when fewer than 200 bars", () => {
    const levels = computeLevels(
      "RELIANCE",
      makeBars(199, () => ({ close: 100 })),
    );
    expect(levels.dma200).toBeNull();
    expect(levels.dma50).toBe(100);
  });

  it("computes dma50 from exactly 50 bars", () => {
    const bars = makeBars(50, (index) => ({ close: index + 1 }));
    const levels = computeLevels("RELIANCE", bars);
    // mean of 1..50 = 25.5
    expect(levels.dma50).toBe(25.5);
  });

  it("computes swingHigh/swingLow from the last 20 bars only", () => {
    const bars = [
      ...makeBars(30, () => ({ high: 999, low: 1 })),
      ...makeBars(20, (index) => ({ high: 200 + index, low: 50 - index })),
    ];
    const levels = computeLevels("RELIANCE", bars);
    expect(levels.swingHigh).toBe(219);
    expect(levels.swingLow).toBe(31);
  });

  it("computes 52-week range across all bars", () => {
    const bars = [makeBar({ high: 500, low: 80 }), makeBar({ high: 300, low: 40 })];
    const levels = computeLevels("RELIANCE", bars);
    expect(levels.weekHigh52).toBe(500);
    expect(levels.weekLow52).toBe(40);
  });
});

describe("getCachedLevels", () => {
  beforeEach(() => {
    mockAll.mockReset();
  });

  it("returns null when data is stale (>26h old)", () => {
    const stale = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    mockAll.mockReturnValue([
      {
        symbol: "RELIANCE",
        date: "2026-06-01",
        dma50: 100,
        dma200: null,
        weekHigh52: 110,
        weekLow52: 90,
        swingHigh: 108,
        swingLow: 92,
        avgVolume20: 1000,
        updatedAt: stale,
      },
    ]);
    expect(getCachedLevels("RELIANCE")).toBeNull();
  });

  it("returns parsed levels when data is fresh", () => {
    mockAll.mockReturnValue([
      {
        symbol: "RELIANCE",
        date: "2026-06-29",
        dma50: 100,
        dma200: null,
        weekHigh52: 110,
        weekLow52: 90,
        swingHigh: 108,
        swingLow: 92,
        avgVolume20: 1000,
        updatedAt: new Date().toISOString(),
      },
    ]);
    const levels = getCachedLevels("RELIANCE");
    expect(levels?.dma50).toBe(100);
  });

  it("returns null when no row exists", () => {
    mockAll.mockReturnValue([]);
    expect(getCachedLevels("RELIANCE")).toBeNull();
  });
});

describe("fetchOHLCV", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an error on a non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );
    const result = await fetchOHLCV("NSE_EQ|INE002A01018", 260);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.statusCode).toBe(500);
    }
  });

  it("parses candles and returns bars sorted oldest-first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "success",
          data: {
            candles: [
              ["2026-06-02T00:00:00+05:30", 101, 111, 91, 106, 2000, 0],
              ["2026-06-01T00:00:00+05:30", 100, 110, 90, 105, 1000, 0],
            ],
          },
        }),
      }),
    );
    const result = await fetchOHLCV("NSE_EQ|INE002A01018", 260);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.timestamp).toBe("2026-06-01T00:00:00+05:30");
      expect(result.value[1]?.timestamp).toBe("2026-06-02T00:00:00+05:30");
    }
  });
});

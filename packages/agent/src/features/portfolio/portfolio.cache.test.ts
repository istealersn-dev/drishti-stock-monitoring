import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockRun, mockDbSelect, mockDbInsert } = vi.hoisted(() => {
  const get = vi.fn();
  const run = vi.fn();
  return {
    mockGet: get,
    mockRun: run,
    mockDbSelect: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ get }) }),
    }),
    mockDbInsert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn().mockReturnValue({ run }) }),
    }),
  };
});

vi.mock("../../db/db.js", () => ({
  db: { select: mockDbSelect, insert: mockDbInsert },
}));

vi.mock("../../db/schema.js", () => ({ holdingsSnapshot: { id: "id" } }));

vi.mock("../../shared/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { Holding } from "../../broker/brokerClient.types.js";

import {
  __resetHoldingsCacheForTests,
  getCachedHoldings,
  updateHoldingsCache,
} from "./portfolio.cache.js";

const holding: Holding = {
  isin: "INE001",
  tradingSymbol: "AXISBANK-EQ",
  companyName: "Axis Bank",
  quantity: 10,
  averagePrice: 1000,
  lastPrice: 1050,
  closePrice: 1000,
  pnl: 500,
  dayChange: 50,
  dayChangePercentage: 5,
  instrumentToken: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
};

beforeEach(() => {
  __resetHoldingsCacheForTests();
  mockGet.mockReset();
  mockRun.mockReset();
  mockDbInsert.mockClear();
  mockDbSelect.mockClear();
});

describe("getCachedHoldings", () => {
  it("returns empty when no snapshot has ever been persisted", () => {
    mockGet.mockReturnValue(undefined);
    expect(getCachedHoldings()).toEqual({ holdings: [], cachedAt: null });
  });

  it("hydrates last-known-good holdings from the persisted snapshot", () => {
    mockGet.mockReturnValue({
      id: 1,
      holdingsJson: JSON.stringify([holding]),
      cachedAt: "2026-07-20T10:00:00.000Z",
    });

    expect(getCachedHoldings()).toEqual({
      holdings: [holding],
      cachedAt: "2026-07-20T10:00:00.000Z",
    });
  });

  it("hydrates from the DB only once, then serves from memory", () => {
    mockGet.mockReturnValue({
      id: 1,
      holdingsJson: JSON.stringify([holding]),
      cachedAt: "2026-07-20T10:00:00.000Z",
    });

    getCachedHoldings();
    getCachedHoldings();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("falls back to empty when the stored JSON is unparseable", () => {
    mockGet.mockReturnValue({ id: 1, holdingsJson: "{not json", cachedAt: "x" });
    expect(getCachedHoldings()).toEqual({ holdings: [], cachedAt: null });
  });

  it("falls back to empty when the stored JSON fails schema validation", () => {
    mockGet.mockReturnValue({
      id: 1,
      holdingsJson: JSON.stringify([{ tradingSymbol: "X" }]),
      cachedAt: "x",
    });
    expect(getCachedHoldings()).toEqual({ holdings: [], cachedAt: null });
  });
});

describe("updateHoldingsCache", () => {
  it("updates memory and reflects immediately without a DB read", () => {
    updateHoldingsCache([holding]);

    const result = getCachedHoldings();
    expect(result.holdings).toEqual([holding]);
    expect(result.cachedAt).not.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("persists a snapshot upsert to the DB", () => {
    updateHoldingsCache([holding]);

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("still updates memory when the DB write throws", () => {
    mockRun.mockImplementation(() => {
      throw new Error("disk full");
    });

    expect(() => {
      updateHoldingsCache([holding]);
    }).not.toThrow();
    expect(getCachedHoldings().holdings).toEqual([holding]);
  });
});

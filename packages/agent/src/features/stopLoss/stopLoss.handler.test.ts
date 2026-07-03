import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateGTT, mockPushAlert, mockDbInsert, mockDbRun, mockDbGet, mockDbSelect } =
  vi.hoisted(() => {
    const mockDatabaseRun = vi.fn();
    const mockDatabaseInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ run: mockDatabaseRun }),
    });
    const mockDatabaseGet = vi.fn();
    const mockDatabaseSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: mockDatabaseGet }),
      }),
    });
    return {
      mockCreateGTT: vi.fn(),
      mockPushAlert: vi.fn(),
      mockDbInsert: mockDatabaseInsert,
      mockDbRun: mockDatabaseRun,
      mockDbGet: mockDatabaseGet,
      mockDbSelect: mockDatabaseSelect,
    };
  });

vi.mock("../gtt/gtt.tools.js", () => ({ createGTT: mockCreateGTT }));
vi.mock("../alerts/alerts.slack.js", () => ({ pushAlert: mockPushAlert }));
vi.mock("../../db/db.js", () => ({ db: { insert: mockDbInsert, select: mockDbSelect } }));
vi.mock("../../shared/env.js", () => ({ env: { DRISHTI_DRY_RUN: true } }));
vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import type { Holding } from "../portfolio/portfolio.schema.js";

import { handleSlBreach } from "./stopLoss.handler.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE238A01034",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank Ltd",
  quantity: 50,
  average_price: 1000,
  last_price: 880,
  close_price: 900,
  pnl: -6000,
  day_change: -20,
  day_change_percentage: -2.22,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

describe("handleSlBreach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ run: mockDbRun }),
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: mockDbGet }),
      }),
    });
    mockDbGet.mockReturnValue(undefined);
    mockPushAlert.mockResolvedValue({ ok: true, value: "ts-123" });
  });

  it("writes two DB rows (gtt_orders + agent_logs) and pushes alert on success", async () => {
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-001",
    );

    expect(mockCreateGTT).toHaveBeenCalledOnce();
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    expect(mockPushAlert).toHaveBeenCalledOnce();
  });

  it("alert message contains symbol, LTP, and DRY RUN note", async () => {
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-002",
    );

    const alert = mockPushAlert.mock.calls[0]?.[0] as string;
    expect(alert).toContain("AXISBANK-EQ");
    expect(alert).toContain("880");
    expect(alert).toContain("DRY RUN");
  });

  it("still writes DB rows and alerts when GTT create fails, with status 'failed'", async () => {
    mockCreateGTT.mockResolvedValue({ ok: false, error: { message: "network timeout" } });
    const valuesSpy = vi.fn().mockReturnValue({ run: mockDbRun });
    mockDbInsert.mockReturnValue({ values: valuesSpy });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 850, slThreshold: 900 },
      "run-003",
    );

    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    expect(mockPushAlert).toHaveBeenCalledOnce();

    const alert = mockPushAlert.mock.calls[0]?.[0] as string;
    expect(alert).toContain("failed");

    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("failed");
  });

  it("skips GTT creation and alert when an active sl_exit GTT already exists", async () => {
    mockDbGet.mockReturnValue({ id: "existing-gtt-id" });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-004",
    );

    expect(mockCreateGTT).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockPushAlert).not.toHaveBeenCalled();
  });

  it("inserts gtt_orders row with status 'active' when GTT create succeeds", async () => {
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });
    const valuesSpy = vi.fn().mockReturnValue({ run: mockDbRun });
    mockDbInsert.mockReturnValue({ values: valuesSpy });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-005",
    );

    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("active");
  });
});

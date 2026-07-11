import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCreateGTT,
  mockPushAlert,
  mockDbInsert,
  mockDbRun,
  mockDbGet,
  mockDbSelect,
  mockIsDryRunActive,
} = vi.hoisted(() => {
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
    mockIsDryRunActive: vi.fn().mockReturnValue(true),
  };
});

vi.mock("../gtt/gtt.tools.js", () => ({ createGTT: mockCreateGTT }));
vi.mock("../alerts/alerts.slack.js", () => ({ pushAlert: mockPushAlert }));
vi.mock("../../db/db.js", () => ({ db: { insert: mockDbInsert, select: mockDbSelect } }));
vi.mock("../../shared/dryRun.js", () => ({ isDryRunActive: mockIsDryRunActive }));
vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import type { Holding } from "../../broker/brokerClient.types.js";

import { handleSlBreach } from "./stopLoss.handler.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE238A01034",
  tradingSymbol: "AXISBANK-EQ",
  companyName: "Axis Bank Ltd",
  quantity: 50,
  averagePrice: 1000,
  lastPrice: 880,
  closePrice: 900,
  pnl: -6000,
  dayChange: -20,
  dayChangePercentage: -2.22,
  instrumentToken: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

describe("handleSlBreach", () => {
  let valuesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    valuesSpy = vi.fn().mockReturnValue({ run: mockDbRun });
    mockDbInsert.mockReturnValue({ values: valuesSpy });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: mockDbGet }),
      }),
    });
    // Default: no active GTT exists yet and the alerted dedup gate hasn't fired.
    mockDbGet.mockReturnValue(undefined);
    mockPushAlert.mockResolvedValue({ ok: true, value: "ts-123" });
    mockIsDryRunActive.mockReturnValue(true);
  });

  it("fresh breach: creates GTT, sends alert, and writes all three log rows", async () => {
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-001",
    );

    expect(mockCreateGTT).toHaveBeenCalledOnce();
    expect(mockPushAlert).toHaveBeenCalledOnce();
    expect(mockDbInsert).toHaveBeenCalledTimes(3); // gtt_orders + sl_exit_gtt_created + sl_exit_alerted

    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("dry_run");

    const actions = valuesSpy.mock.calls
      .slice(1)
      .map((call) => (call[0] as { action: string }).action);
    expect(actions).toEqual(["sl_exit_gtt_created", "sl_exit_alerted"]);
  });

  it("fresh breach with dry-run off: writes 'active' status, not 'dry_run'", async () => {
    mockIsDryRunActive.mockReturnValue(false);
    mockCreateGTT.mockResolvedValue({ ok: true, value: "order-id-123" });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-005",
    );

    expect(mockCreateGTT).toHaveBeenCalledWith(expect.anything(), false);
    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("active");
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

  it("GTT create fails: writes 'failed' status and action, still alerts every time (no alerted-dedup row)", async () => {
    mockCreateGTT.mockResolvedValue({ ok: false, error: { message: "network timeout" } });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 850, slThreshold: 900 },
      "run-003",
    );

    expect(mockPushAlert).toHaveBeenCalledOnce();
    const alert = mockPushAlert.mock.calls[0]?.[0] as string;
    expect(alert).toContain("failed");

    // Only gtt_orders + sl_exit_gtt_failed rows — no sl_exit_alerted row, since a failed
    // create should keep alerting every tick rather than being deduped.
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("failed");
    const logRowValues = valuesSpy.mock.calls[1]?.[0] as { action: string };
    expect(logRowValues.action).toBe("sl_exit_gtt_failed");
  });

  it("skips entirely when an active GTT exists and the alerted dedup row already exists this session", async () => {
    mockDbGet.mockReturnValue({ id: "existing-row-id" });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-004",
    );

    expect(mockCreateGTT).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockPushAlert).not.toHaveBeenCalled();
  });

  it("retries the alert without recreating the GTT when it's already active but not yet alerted", async () => {
    // First check (hasActiveSlExitGtt) hits, second check (alerted gate) misses. Unlike
    // the alert dedup, hasActiveSlExitGtt takes no time window, so this holds no matter
    // how long the breach persists — a breach spanning multiple trading sessions (e.g. a
    // stock stuck at a circuit limit for days) must never get a second exit GTT stacked
    // on top of the first just because a time-based window would have elapsed.
    mockDbGet.mockReturnValueOnce({ id: "existing-gtt-row-id" }).mockReturnValueOnce(undefined);

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-005",
    );

    expect(mockCreateGTT).not.toHaveBeenCalled();
    expect(mockPushAlert).toHaveBeenCalledOnce();
    // Only the sl_exit_alerted row is written — no new gtt_orders/sl_exit_gtt_created rows.
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const logRowValues = valuesSpy.mock.calls[0]?.[0] as { action: string };
    expect(logRowValues.action).toBe("sl_exit_alerted");
  });

  it("always alerts a freshly created GTT, even if a stale alerted-dedup row exists from an earlier breach on this symbol", async () => {
    // No active GTT (e.g. the previous one was cancelled/modified elsewhere), but an
    // sl_exit_alerted row from that earlier, now-resolved breach is still inside the
    // trading-day window. A brand-new GTT created now must still get its own alert —
    // the stale dedup row must not swallow notification of a genuinely new order.
    mockDbGet.mockReturnValueOnce(undefined).mockReturnValueOnce({ id: "stale-alerted-row-id" });
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-007",
    );

    expect(mockCreateGTT).toHaveBeenCalledOnce();
    expect(mockPushAlert).toHaveBeenCalledOnce();
    expect(mockDbInsert).toHaveBeenCalledTimes(3); // gtt_orders + sl_exit_gtt_created + sl_exit_alerted
  });

  it("does not write the alerted-dedup row when pushAlert fails, so the next tick retries", async () => {
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT..." });
    mockPushAlert.mockResolvedValue({ ok: false, error: { message: "Slack down" } });

    await handleSlBreach(
      { holding: makeHolding(), lastTradedPrice: 880, slThreshold: 900 },
      "run-006",
    );

    // gtt_orders + sl_exit_gtt_created only — no sl_exit_alerted row, since delivery
    // was never confirmed.
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    const actions = valuesSpy.mock.calls.map((call) => (call[0] as { action?: string }).action);
    expect(actions).not.toContain("sl_exit_alerted");
  });
});

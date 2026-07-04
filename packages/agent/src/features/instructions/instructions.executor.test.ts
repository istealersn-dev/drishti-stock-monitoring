import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetApproval,
  mockResolveApproval,
  mockCreateGTT,
  mockFetchMargins,
  mockUpdateApprovalCard,
  mockIsDryRunActive,
  mockDbInsert,
} = vi.hoisted(() => ({
  mockGetApproval: vi.fn(),
  mockResolveApproval: vi.fn(),
  mockCreateGTT: vi.fn(),
  mockFetchMargins: vi.fn(),
  mockUpdateApprovalCard: vi.fn(),
  mockIsDryRunActive: vi.fn().mockReturnValue(false),
  mockDbInsert: vi.fn(),
}));

vi.mock("../../db/db.js", () => ({ db: { insert: mockDbInsert } }));
vi.mock("../approval/approval.store.js", () => ({
  getApproval: mockGetApproval,
  resolveApproval: mockResolveApproval,
}));
vi.mock("../gtt/gtt.tools.js", () => ({ createGTT: mockCreateGTT }));
vi.mock("../portfolio/portfolio.tools.js", () => ({ fetchMargins: mockFetchMargins }));
vi.mock("./instructions.approval.js", () => ({ updateApprovalCard: mockUpdateApprovalCard }));
vi.mock("../../shared/dryRun.js", () => ({ isDryRunActive: mockIsDryRunActive }));
vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { ApprovalRow } from "../approval/approval.store.js";

import { calculateSuggestedQty, executeApprovedInstruction } from "./instructions.executor.js";

const makeApproval = (overrides: Partial<ApprovalRow> = {}): ApprovalRow => ({
  id: "approval-1",
  symbol: "RAMCOSYS-EQ",
  parsedJson: JSON.stringify({
    stockName: "Ramco Systems",
    action: "BUY",
    entryLow: 560,
    entryHigh: 580,
    stopLoss: 520,
    targets: [{ price: 680, isOpenEnded: false }],
    _instrumentToken: "NSE_EQ|INE123",
  }),
  suggestedQty: 10,
  status: "pending",
  slackTs: null,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  ...overrides,
});

describe("calculateSuggestedQty", () => {
  it("floors qty from available margin over the midpoint entry price", () => {
    expect(calculateSuggestedQty(10000, 580, 560)).toBe(Math.floor(10000 / 570));
  });

  it("uses entryHigh as the midpoint when entryLow is not given", () => {
    expect(calculateSuggestedQty(1000, 500)).toBe(2);
  });

  it("never returns less than 1", () => {
    expect(calculateSuggestedQty(1, 10000)).toBe(1);
  });
});

describe("executeApprovedInstruction", () => {
  let valuesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const run = vi.fn();
    valuesSpy = vi
      .fn()
      .mockReturnValue({ run, onConflictDoUpdate: vi.fn().mockReturnValue({ run }) });
    mockDbInsert.mockReturnValue({ values: valuesSpy });
    mockFetchMargins.mockResolvedValue({ ok: true, value: { available_margin: 10000 } });
    mockUpdateApprovalCard.mockResolvedValue({ ok: true });
    mockIsDryRunActive.mockReturnValue(false);
  });

  it("returns an error when the approval doesn't exist", async () => {
    mockGetApproval.mockReturnValue(null);

    const result = await executeApprovedInstruction("missing-id", "run-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not found");
  });

  it("returns an error when the approval was already resolved", async () => {
    mockGetApproval.mockReturnValue(makeApproval({ status: "approved" }));

    const result = await executeApprovedInstruction("approval-1", "run-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already approved");
  });

  it("creates a GTT with status 'active' and dryRun=false when not in dry-run mode", async () => {
    mockGetApproval.mockReturnValue(makeApproval());
    mockCreateGTT.mockResolvedValue({ ok: true, value: "order-id-123" });

    const result = await executeApprovedInstruction("approval-1", "run-1");

    expect(result.ok).toBe(true);
    expect(mockCreateGTT).toHaveBeenCalledWith(expect.objectContaining({ quantity: 17 }), false);

    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("active");

    // Call order: gttOrders, stockConfig, agentLogs (buy_entry_gtt_created).
    const auditLogValues = valuesSpy.mock.calls[2]?.[0] as { dryRun: boolean };
    expect(auditLogValues.dryRun).toBe(false);
  });

  it("creates a GTT with status 'dry_run' and passes dryRun=true through to createGTT when dry-run is active", async () => {
    mockGetApproval.mockReturnValue(makeApproval());
    mockCreateGTT.mockResolvedValue({ ok: true, value: "[DRY_RUN] would create GTT" });
    mockIsDryRunActive.mockReturnValue(true);

    await executeApprovedInstruction("approval-1", "run-1");

    expect(mockCreateGTT).toHaveBeenCalledWith(expect.anything(), true);

    const gttRowValues = valuesSpy.mock.calls[0]?.[0] as { status: string };
    expect(gttRowValues.status).toBe("dry_run");
  });

  it("logs buy_entry_gtt_failed and does not write a GTT row when createGTT fails", async () => {
    mockGetApproval.mockReturnValue(makeApproval());
    mockCreateGTT.mockResolvedValue({ ok: false, error: { message: "Upstox rejected order" } });

    const result = await executeApprovedInstruction("approval-1", "run-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Upstox rejected order");
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const logValues = valuesSpy.mock.calls[0]?.[0] as { action: string };
    expect(logValues.action).toBe("buy_entry_gtt_failed");
    expect(mockResolveApproval).not.toHaveBeenCalled();
  });

  it("returns an error when entryHigh is missing from the stored instruction", async () => {
    mockGetApproval.mockReturnValue(
      makeApproval({
        parsedJson: JSON.stringify({
          stockName: "Ramco Systems",
          action: "BUY",
          entryLow: null,
          entryHigh: null,
          stopLoss: 520,
          targets: [],
          _instrumentToken: "NSE_EQ|INE123",
        }),
      }),
    );

    const result = await executeApprovedInstruction("approval-1", "run-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("entryHigh missing");
    expect(mockCreateGTT).not.toHaveBeenCalled();
  });
});

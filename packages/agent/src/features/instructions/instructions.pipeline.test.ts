import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockParseInstruction,
  mockResolveSymbol,
  mockValidateRiskReward,
  mockAnalyzeBuyInstruction,
  mockFetchMargins,
  mockValidateConcentration,
  mockCalculateSuggestedQty,
  mockCreateApproval,
  mockSetApprovalSlackTs,
  mockGetApproval,
  mockSetApprovalOverrideQty,
  mockSendApprovalCard,
  mockPushAlert,
} = vi.hoisted(() => ({
  mockParseInstruction: vi.fn(),
  mockResolveSymbol: vi.fn(),
  mockValidateRiskReward: vi.fn(),
  mockAnalyzeBuyInstruction: vi.fn(),
  mockFetchMargins: vi.fn(),
  mockValidateConcentration: vi.fn(),
  mockCalculateSuggestedQty: vi.fn(),
  mockCreateApproval: vi.fn(),
  mockSetApprovalSlackTs: vi.fn(),
  mockGetApproval: vi.fn(),
  mockSetApprovalOverrideQty: vi.fn(),
  mockSendApprovalCard: vi.fn(),
  mockPushAlert: vi.fn(),
}));

vi.mock("./instructions.parser.js", () => ({ parseInstruction: mockParseInstruction }));
vi.mock("./instructions.resolver.js", () => ({ resolveSymbol: mockResolveSymbol }));
vi.mock("../validator/validator.rr.js", () => ({ validateRiskReward: mockValidateRiskReward }));
vi.mock("./instructions.analysis.js", () => ({ analyzeBuyInstruction: mockAnalyzeBuyInstruction }));
vi.mock("../portfolio/portfolio.tools.js", () => ({ fetchMargins: mockFetchMargins }));
vi.mock("../validator/validator.concentration.js", () => ({
  validateConcentration: mockValidateConcentration,
}));
vi.mock("./instructions.executor.js", () => ({
  calculateSuggestedQty: mockCalculateSuggestedQty,
}));
vi.mock("../approval/approval.store.js", () => ({
  createApproval: mockCreateApproval,
  setApprovalSlackTs: mockSetApprovalSlackTs,
  getApproval: mockGetApproval,
  setApprovalOverrideQty: mockSetApprovalOverrideQty,
}));
vi.mock("./instructions.approval.js", () => ({ sendApprovalCard: mockSendApprovalCard }));
vi.mock("../alerts/alerts.slack.js", () => ({ pushAlert: mockPushAlert }));
vi.mock("../../shared/env.js", () => ({ env: { SLACK_ALERT_CHANNEL_ID: "C_ALERTS" } }));

import { err, ok } from "../../shared/errors.js";

import {
  applyAmountOverride,
  processValidatedInstruction,
  submitBuyInstruction,
  validateBuyInstruction,
} from "./instructions.pipeline.js";
import type { ParsedInstruction, ResolvedStock } from "./instructions.schema.js";

const instruction: ParsedInstruction = {
  stockName: "Ramco Systems",
  action: "BUY",
  entryLow: 560,
  entryHigh: 580,
  stopLoss: 520,
  targets: [{ price: 680, isOpenEnded: false }],
};

const resolved: ResolvedStock = {
  tradingSymbol: "RAMCOSYS-EQ",
  exchange: "NSE",
  instrumentToken: "NSE_EQ|INE001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPushAlert.mockResolvedValue(ok("ts-001"));
  mockParseInstruction.mockResolvedValue(ok({ instruction, actionDisagreement: null }));
  mockResolveSymbol.mockResolvedValue(ok(resolved));
  mockValidateRiskReward.mockReturnValue({ pass: true });
  mockAnalyzeBuyInstruction.mockResolvedValue(ok("Looks fine."));
  mockFetchMargins.mockResolvedValue(ok({ available_margin: 100_000 }));
  mockValidateConcentration.mockResolvedValue({ pass: true });
  mockCalculateSuggestedQty.mockReturnValue(10);
  mockCreateApproval.mockReturnValue(undefined);
  mockSetApprovalSlackTs.mockReturnValue(undefined);
  mockSendApprovalCard.mockResolvedValue(ok("slack-ts-001"));
});

describe("validateBuyInstruction", () => {
  it("returns the validated instruction when parse, resolve, and R:R all pass", async () => {
    const result = await validateBuyInstruction("Ramco Systems Buy 560-580 SL 520 Tgt 680", "ui");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ instruction, actionDisagreement: null, resolved });
    expect(mockPushAlert).not.toHaveBeenCalled();
  });

  it("returns an error and pushes an alert when parsing fails", async () => {
    mockParseInstruction.mockResolvedValue(err(new Error("could not parse")));

    const result = await validateBuyInstruction("garbage text", "ui");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("could not parse");
    expect(mockPushAlert).toHaveBeenCalledWith(
      expect.stringContaining("Could not parse instruction"),
    );
    expect(mockResolveSymbol).not.toHaveBeenCalled();
  });

  it("returns an error and pushes an alert when symbol resolution fails", async () => {
    mockResolveSymbol.mockResolvedValue(err(new Error("no NSE equity found")));

    const result = await validateBuyInstruction("Unknown Stock Buy 100 SL 90 Tgt 120", "ui");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no NSE equity found");
    expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("Could not resolve symbol"));
    expect(mockValidateRiskReward).not.toHaveBeenCalled();
  });

  it("returns an error and pushes an alert when the R:R gate fails", async () => {
    mockValidateRiskReward.mockReturnValue({ pass: false, reason: "R:R is 1:0.9 (minimum 1:2)" });

    const result = await validateBuyInstruction("Ramco Systems Buy 560-580 SL 520 Tgt 600", "ui");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("R:R is 1:0.9 (minimum 1:2)");
    expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("Trade Rejected"));
  });
});

describe("processValidatedInstruction", () => {
  const validated = { instruction, actionDisagreement: null, resolved };

  it("creates the approval, sends the card, and returns approvalId+symbol on success", async () => {
    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.symbol).toBe("RAMCOSYS-EQ");
    expect(mockCreateApproval).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "RAMCOSYS-EQ", suggestedQty: 10 }),
    );
    expect(mockSetApprovalSlackTs).toHaveBeenCalledWith(result.approvalId, "slack-ts-001");
  });

  it("pushes a concentration warning but still proceeds to approval", async () => {
    mockValidateConcentration.mockResolvedValue({
      pass: false,
      reason: "exceeds 25% single-position cap",
    });

    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(true);
    expect(mockPushAlert).toHaveBeenCalledWith(expect.stringContaining("Concentration Warning"));
    expect(mockCreateApproval).toHaveBeenCalled();
  });

  it("returns an error and does not mark the Slack ts when sending the approval card fails", async () => {
    mockSendApprovalCard.mockResolvedValue(err(new Error("Slack rate limit")));

    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Slack rate limit");
    expect(mockSetApprovalSlackTs).not.toHaveBeenCalled();
    expect(mockPushAlert).toHaveBeenCalledWith(
      expect.stringContaining("Failed to post approval card"),
    );
  });

  it("falls back to qty 1 and zero margin when the margin fetch fails, without failing the whole pipeline", async () => {
    mockFetchMargins.mockResolvedValue(err(new Error("margin API down")));
    mockCalculateSuggestedQty.mockReturnValue(1);

    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(true);
    expect(mockCalculateSuggestedQty).toHaveBeenCalledWith(0, 580, 560);
  });

  it("returns an error and alerts, without sending the card, when createApproval throws", async () => {
    mockCreateApproval.mockImplementation(() => {
      throw new Error("database is locked");
    });

    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("database is locked");
    expect(mockSendApprovalCard).not.toHaveBeenCalled();
    expect(mockPushAlert).toHaveBeenCalledWith(
      expect.stringContaining("Failed to create approval"),
    );
  });

  it("still returns ok and alerts, without failing the submission, when setApprovalSlackTs throws", async () => {
    mockSetApprovalSlackTs.mockImplementation(() => {
      throw new Error("database is locked");
    });

    const result = await processValidatedInstruction(validated);
    expect(result.ok).toBe(true);
    expect(mockPushAlert).toHaveBeenCalledWith(
      expect.stringContaining("failed to record its Slack reference"),
    );
  });
});

describe("submitBuyInstruction", () => {
  it("short-circuits without processing when validation fails", async () => {
    mockValidateRiskReward.mockReturnValue({ pass: false, reason: "bad R:R" });

    const result = await submitBuyInstruction("Ramco Systems Buy 560-580 SL 520 Tgt 600", "C1");
    expect(result).toEqual({ ok: false, error: "bad R:R" });
    expect(mockAnalyzeBuyInstruction).not.toHaveBeenCalled();
  });

  it("runs validation then processing and returns the final result on success", async () => {
    const result = await submitBuyInstruction("Ramco Systems Buy 560-580 SL 520 Tgt 680", "C1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.symbol).toBe("RAMCOSYS-EQ");
    expect(mockAnalyzeBuyInstruction).toHaveBeenCalled();
  });
});

describe("applyAmountOverride", () => {
  const approvalRow = {
    id: "approval-1",
    symbol: "RAMCOSYS-EQ",
    parsedJson: JSON.stringify(instruction),
    suggestedQty: 10,
    overrideQty: null,
    status: "pending" as const,
    slackTs: "slack-ts-001",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  it("computes qty from the amount and persists it as the override", () => {
    mockGetApproval.mockReturnValue(approvalRow);
    mockCalculateSuggestedQty.mockReturnValue(86);

    const result = applyAmountOverride("approval-1", 50_000);

    expect(result).toEqual({ ok: true, qty: 86 });
    expect(mockCalculateSuggestedQty).toHaveBeenCalledWith(50_000, 580, 560);
    expect(mockSetApprovalOverrideQty).toHaveBeenCalledWith("approval-1", 86);
  });

  it("returns an error when the approval doesn't exist", () => {
    mockGetApproval.mockReturnValue(null);

    const result = applyAmountOverride("missing-id", 50_000);

    expect(result).toEqual({ ok: false, error: "Approval not found" });
    expect(mockSetApprovalOverrideQty).not.toHaveBeenCalled();
  });

  it("returns an error when the approval is already resolved", () => {
    mockGetApproval.mockReturnValue({ ...approvalRow, status: "approved" });

    const result = applyAmountOverride("approval-1", 50_000);

    expect(result).toEqual({ ok: false, error: "Already approved" });
    expect(mockSetApprovalOverrideQty).not.toHaveBeenCalled();
  });

  it("returns an error when the stored instruction has no entry price", () => {
    mockGetApproval.mockReturnValue({
      ...approvalRow,
      parsedJson: JSON.stringify({ ...instruction, entryLow: null, entryHigh: null }),
    });

    const result = applyAmountOverride("approval-1", 50_000);

    expect(result).toEqual({ ok: false, error: "Instruction is missing an entry price" });
    expect(mockSetApprovalOverrideQty).not.toHaveBeenCalled();
  });
});

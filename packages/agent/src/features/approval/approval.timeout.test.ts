import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindExpiredPending, mockResolveApproval, mockUpdateApprovalCard } = vi.hoisted(() => ({
  mockFindExpiredPending: vi.fn(),
  mockResolveApproval: vi.fn(),
  mockUpdateApprovalCard: vi.fn(),
}));

vi.mock("./approval.store.js", () => ({
  findExpiredPending: mockFindExpiredPending,
  resolveApproval: mockResolveApproval,
  getApproval: vi.fn(),
  createApproval: vi.fn(),
  setApprovalSlackTs: vi.fn(),
}));

vi.mock("../instructions/instructions.approval.js", () => ({
  updateApprovalCard: mockUpdateApprovalCard,
  sendApprovalCard: vi.fn(),
}));

vi.mock("../../shared/env.js", () => ({
  env: { DRISHTI_APPROVAL_TIMEOUT_MINUTES: 10 },
}));

vi.mock("../../shared/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { expireTimedOutApprovals } from "./approval.timeout.js";

describe("expireTimedOutApprovals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateApprovalCard.mockResolvedValue({ ok: true });
  });

  it("does nothing when no expired approvals exist", async () => {
    mockFindExpiredPending.mockReturnValue([]);
    await expireTimedOutApprovals();
    expect(mockResolveApproval).not.toHaveBeenCalled();
  });

  it("resolves each expired approval and updates the Slack card", async () => {
    mockFindExpiredPending.mockReturnValue([
      {
        id: "uuid-001",
        symbol: "AXISBANK-EQ",
        slackTs: "ts-111",
        parsedJson: "{}",
        suggestedQty: 10,
        status: "pending",
        createdAt: "2025-01-01T00:00:00.000Z",
        resolvedAt: null,
      },
    ]);

    await expireTimedOutApprovals();

    expect(mockResolveApproval).toHaveBeenCalledWith("uuid-001", "expired");
    expect(mockUpdateApprovalCard).toHaveBeenCalledWith("ts-111", "AXISBANK-EQ", "expired");
  });

  it("skips card update when approval has no slackTs", async () => {
    mockFindExpiredPending.mockReturnValue([
      {
        id: "uuid-002",
        symbol: "RELIANCE-EQ",
        slackTs: null,
        parsedJson: "{}",
        suggestedQty: 5,
        status: "pending",
        createdAt: "2025-01-01T00:00:00.000Z",
        resolvedAt: null,
      },
    ]);

    await expireTimedOutApprovals();

    expect(mockResolveApproval).toHaveBeenCalledWith("uuid-002", "expired");
    expect(mockUpdateApprovalCard).not.toHaveBeenCalled();
  });
});

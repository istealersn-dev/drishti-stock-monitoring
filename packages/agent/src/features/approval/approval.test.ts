import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockAll = vi.fn();

const { mockDbInsert, mockDbSelect, mockDbUpdate } = vi.hoisted(() => {
  const innerRun = vi.fn();
  const innerAll = vi.fn();
  return {
    mockDbInsert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ run: innerRun }) }),
    mockDbSelect: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ all: innerAll }) }),
    }),
    mockDbUpdate: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: innerRun }) }),
    }),
  };
});

vi.mock("../../db/db.js", () => ({
  db: { insert: mockDbInsert, select: mockDbSelect, update: mockDbUpdate },
}));

vi.mock("../../db/schema.js", () => ({ pendingApprovals: {} }));

import { createApproval, getApproval, resolveApproval } from "./approval.store.js";

describe("approval.store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnValue({ values: vi.fn().mockReturnValue({ run: mockRun }) });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ all: mockAll }) }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: mockRun }) }),
    });
  });

  it("createApproval calls db.insert with correct fields", () => {
    createApproval({ id: "uuid-001", symbol: "RAMCOSYS-EQ", parsedJson: "{}", suggestedQty: 52 });
    expect(mockDbInsert).toHaveBeenCalledOnce();
  });

  it("getApproval returns null when no rows found", () => {
    mockAll.mockReturnValue([]);
    expect(getApproval("uuid-001")).toBeNull();
  });

  it("getApproval returns the row with typed status", () => {
    mockAll.mockReturnValue([
      {
        id: "uuid-001",
        symbol: "RAMCOSYS-EQ",
        parsedJson: "{}",
        suggestedQty: 52,
        status: "pending",
        slackTs: "ts-123",
        createdAt: "2025-01-01T00:00:00.000Z",
        resolvedAt: null,
      },
    ]);
    const result = getApproval("uuid-001");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("pending");
    expect(result?.symbol).toBe("RAMCOSYS-EQ");
  });

  it("resolveApproval calls db.update with new status", () => {
    resolveApproval("uuid-001", "approved");
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi } from "vitest";

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock("../db/db.js", () => ({
  db: { select: mockDbSelect },
}));

vi.mock("../db/schema.js", () => ({
  agentSettings: { key: "key", value: "value" },
}));

function mockActiveBrokerIdRow(row: { value: string } | undefined): void {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(row) }),
    }),
  });
}

import { getActiveBrokerClient } from "./brokerClient.registry.js";

describe("getActiveBrokerClient", () => {
  it("returns an Upstox client when active_broker_id is upstox", () => {
    mockActiveBrokerIdRow({ value: "upstox" });
    expect(getActiveBrokerClient().id).toBe("upstox");
  });

  it("defaults to an Upstox client when no active_broker_id setting exists yet", () => {
    mockActiveBrokerIdRow(undefined);
    expect(getActiveBrokerClient().id).toBe("upstox");
  });

  it("falls back to Upstox for a broker id with no adapter yet (e.g. groww)", () => {
    mockActiveBrokerIdRow({ value: "groww" });
    expect(getActiveBrokerClient().id).toBe("upstox");
  });
});

import { describe, expect, it } from "vitest";

import { gttStatusVariant, gttTypeLabel, gttTypeVariant } from "./gttFormat";

describe("gttTypeLabel", () => {
  it("labels the types the agent writes", () => {
    expect(gttTypeLabel("sl_exit")).toBe("SL Exit");
    expect(gttTypeLabel("buy_entry")).toBe("Buy Entry");
  });

  it("falls back to the uppercased type", () => {
    expect(gttTypeLabel("two_leg")).toBe("TWO_LEG");
  });
});

describe("gttTypeVariant", () => {
  it("marks stop-loss orders as risk", () => {
    expect(gttTypeVariant("sl_exit")).toBe("neg");
    expect(gttTypeVariant("buy_entry")).toBe("info");
  });
});

describe("gttStatusVariant", () => {
  it("falls back to neutral for unknown statuses", () => {
    expect(gttStatusVariant("dry_run")).toBe("neutral");
  });
});

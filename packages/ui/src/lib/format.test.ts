import { describe, expect, it } from "vitest";

import { PLACEHOLDER, formatInr, formatPriceOrDash, formatSignedInr } from "./format";

describe("formatSignedInr", () => {
  it("adds a plus to gains and zero", () => {
    expect(formatSignedInr(500)).toBe("+₹500");
    expect(formatSignedInr(0)).toBe("+₹0");
  });

  it("uses a true minus for losses without doubling the sign", () => {
    expect(formatSignedInr(-500)).toBe("−₹500");
  });
});

describe("formatInr", () => {
  it("abbreviates to lakhs at ₹1L and above", () => {
    expect(formatInr(420_000)).toBe("₹4.2L");
  });
});

describe("formatPriceOrDash", () => {
  it("shows the placeholder for an unset price", () => {
    expect(formatPriceOrDash(null)).toBe(PLACEHOLDER);
  });
});

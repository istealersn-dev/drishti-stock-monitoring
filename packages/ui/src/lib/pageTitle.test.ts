import { describe, expect, it } from "vitest";

import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("names the page", () => {
    expect(pageTitle("/")).toBe("Dashboard · Drishti");
    expect(pageTitle("/instructions")).toBe("Approvals · Drishti");
  });

  it("uses the parent for nested routes", () => {
    expect(pageTitle("/settings/connect/upstox")).toBe("Settings · Drishti");
  });

  it("falls back to the app name", () => {
    expect(pageTitle("/nope")).toBe("Drishti");
  });
});

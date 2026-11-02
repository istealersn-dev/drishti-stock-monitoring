import { describe, expect, it } from "vitest";

import { approvalsSearchSchema, holdingsSearchSchema, settingsSearchSchema } from "./routeSearch";

describe("route search schemas", () => {
  it("accepts known values", () => {
    expect(approvalsSearchSchema.parse({ tab: "drishti" }).tab).toBe("drishti");
    expect(holdingsSearchSchema.parse({ filter: "BREACH" }).filter).toBe("BREACH");
    expect(settingsSearchSchema.parse({ tab: "danger" }).tab).toBe("danger");
  });

  it("falls back to the default view on a bad URL", () => {
    expect(approvalsSearchSchema.parse({ tab: "nope" }).tab).toBeUndefined();
    expect(holdingsSearchSchema.parse({ filter: 5 }).filter).toBeUndefined();
    expect(settingsSearchSchema.parse({}).tab).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";

import { getActiveBrokerClient } from "./brokerClient.registry.js";

describe("getActiveBrokerClient", () => {
  it("returns an Upstox client", () => {
    const client = getActiveBrokerClient();
    expect(client.id).toBe("upstox");
  });
});

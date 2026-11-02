import { describe, expect, it } from "vitest";

import { createAuthThrottle, isValidAccessKey } from "./api.auth.js";

const WINDOW_MS = 15 * 60 * 1000;
const FAILURES_TO_BLOCK = 10;

describe("isValidAccessKey", () => {
  it("accepts the right key", () => {
    expect(isValidAccessKey("secret", "secret")).toBe(true);
  });

  it("rejects a wrong key of any length", () => {
    expect(isValidAccessKey("secre", "secret")).toBe(false);
    expect(isValidAccessKey("secret-longer", "secret")).toBe(false);
  });

  it("rejects a missing or repeated header", () => {
    expect(isValidAccessKey(undefined, "secret")).toBe(false);
    expect(isValidAccessKey(["secret"], "secret")).toBe(false);
  });
});

describe("createAuthThrottle", () => {
  const failTimes = (throttle: ReturnType<typeof createAuthThrottle>, times: number): void => {
    for (let index = 0; index < times; index += 1) throttle.recordFailure("a");
  };

  it("blocks only after the limit, and only that client", () => {
    const throttle = createAuthThrottle(() => 0);
    failTimes(throttle, FAILURES_TO_BLOCK - 1);
    expect(throttle.retryAfterSeconds("a")).toBe(0);
    failTimes(throttle, 1);
    expect(throttle.retryAfterSeconds("a")).toBe(WINDOW_MS / 1000);
    expect(throttle.retryAfterSeconds("b")).toBe(0);
  });

  it("unblocks when the window ends", () => {
    let time = 0;
    const throttle = createAuthThrottle(() => time);
    failTimes(throttle, FAILURES_TO_BLOCK);
    time = WINDOW_MS;
    expect(throttle.retryAfterSeconds("a")).toBe(0);
  });

  it("starts a new count after the window ends", () => {
    let time = 0;
    const throttle = createAuthThrottle(() => time);
    failTimes(throttle, FAILURES_TO_BLOCK - 1);
    time = WINDOW_MS;
    failTimes(throttle, 1);
    expect(throttle.retryAfterSeconds("a")).toBe(0);
  });

  it("forgets failures once cleared", () => {
    const throttle = createAuthThrottle(() => 0);
    failTimes(throttle, FAILURES_TO_BLOCK);
    throttle.clear("a");
    expect(throttle.retryAfterSeconds("a")).toBe(0);
  });
});

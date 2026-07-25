import { describe, expect, it } from "vitest";

import { judgeSlackConnection, SLACK_RECONNECT_GRACE_MS } from "./slackConnection.policy.js";

const NOW = 1_700_000_000_000;

describe("judgeSlackConnection", () => {
  it("is healthy while connected", () => {
    expect(judgeSlackConnection({ connected: true, disconnectedSince: null, now: NOW })).toBe(
      "healthy",
    );
  });

  it("is healthy while connected even if a stale disconnect timestamp lingers", () => {
    expect(
      judgeSlackConnection({
        connected: true,
        disconnectedSince: NOW - SLACK_RECONNECT_GRACE_MS * 10,
        now: NOW,
      }),
    ).toBe("healthy");
  });

  it("is recovering inside the grace period", () => {
    expect(
      judgeSlackConnection({
        connected: false,
        disconnectedSince: NOW - (SLACK_RECONNECT_GRACE_MS - 1),
        now: NOW,
      }),
    ).toBe("recovering");
  });

  it("is stalled once the disconnect reaches the grace period", () => {
    expect(
      judgeSlackConnection({
        connected: false,
        disconnectedSince: NOW - SLACK_RECONNECT_GRACE_MS,
        now: NOW,
      }),
    ).toBe("stalled");
  });

  it("is recovering when disconnected with no recorded start", () => {
    expect(judgeSlackConnection({ connected: false, disconnectedSince: null, now: NOW })).toBe(
      "recovering",
    );
  });

  it("honours a caller-supplied grace period", () => {
    expect(
      judgeSlackConnection({
        connected: false,
        disconnectedSince: NOW - 5000,
        now: NOW,
        graceMs: 1000,
      }),
    ).toBe("stalled");
  });
});

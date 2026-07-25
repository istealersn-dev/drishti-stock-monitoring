import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLACK_RECONNECT_GRACE_MS } from "./slackConnection.policy.js";
import { startSlackConnectionWatchdog } from "./slackConnection.watchdog.js";

const PAST_GRACE_MS = SLACK_RECONNECT_GRACE_MS + 60_000;

describe("startSlackConnectionWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports stalled when the client never connects", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    vi.advanceTimersByTime(PAST_GRACE_MS);

    expect(onStalled).toHaveBeenCalledTimes(1);
  });

  it("stays quiet while connected", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    client.emit("connected");
    vi.advanceTimersByTime(PAST_GRACE_MS * 3);

    expect(onStalled).not.toHaveBeenCalled();
  });

  it("stays quiet while a disconnect is still inside the grace period", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    client.emit("connected");
    client.emit("reconnecting");
    vi.advanceTimersByTime(SLACK_RECONNECT_GRACE_MS - 30_000);

    expect(onStalled).not.toHaveBeenCalled();
  });

  it("reports stalled when a disconnect outlives the grace period", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    client.emit("connected");
    client.emit("reconnecting");
    vi.advanceTimersByTime(PAST_GRACE_MS);

    expect(onStalled).toHaveBeenCalledTimes(1);
    expect(onStalled.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(SLACK_RECONNECT_GRACE_MS);
  });

  it("reports stalled only once per outage", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    client.emit("connecting");
    vi.advanceTimersByTime(PAST_GRACE_MS * 4);

    expect(onStalled).toHaveBeenCalledTimes(1);
  });

  it("recovers and can report a second, later outage", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    vi.advanceTimersByTime(PAST_GRACE_MS);
    expect(onStalled).toHaveBeenCalledTimes(1);

    client.emit("connected");
    vi.advanceTimersByTime(PAST_GRACE_MS);
    expect(onStalled).toHaveBeenCalledTimes(1);

    client.emit("disconnected");
    vi.advanceTimersByTime(PAST_GRACE_MS);
    expect(onStalled).toHaveBeenCalledTimes(2);
  });

  it("stops reporting after the returned stop function is called", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    const stop = startSlackConnectionWatchdog(client, { onStalled });
    stop();
    vi.advanceTimersByTime(PAST_GRACE_MS * 2);

    expect(onStalled).not.toHaveBeenCalled();
  });

  it("survives an error event without reporting a stall", () => {
    const client = new EventEmitter();
    const onStalled = vi.fn();

    startSlackConnectionWatchdog(client, { onStalled });
    client.emit("connected");
    client.emit("error", new Error("websocket blew up"));
    vi.advanceTimersByTime(PAST_GRACE_MS);

    expect(onStalled).not.toHaveBeenCalled();
  });
});

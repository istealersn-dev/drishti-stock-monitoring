import { describe, it, expect, vi } from "vitest";

import { createSingleFlightGuard } from "./singleFlight.js";

describe("createSingleFlightGuard", () => {
  it("runs fn and returns true when no run is in progress", async () => {
    const guard = createSingleFlightGuard();
    const fn = vi.fn().mockResolvedValue(undefined);

    const started = await guard.tryRun(fn);

    expect(started).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("returns false without invoking fn while a previous run is still in progress", async () => {
    const guard = createSingleFlightGuard();
    let resolveFirst: (() => void) | undefined;
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const first = guard.tryRun(fn);
    const second = await guard.tryRun(fn);

    expect(second).toBe(false);
    expect(fn).toHaveBeenCalledOnce();

    resolveFirst?.();
    await first;
  });

  it("allows a new run once the previous one has completed", async () => {
    const guard = createSingleFlightGuard();
    const fn = vi.fn().mockResolvedValue(undefined);

    await guard.tryRun(fn);
    await guard.tryRun(fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the guard and propagates the error when fn rejects", async () => {
    const guard = createSingleFlightGuard();
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom"));

    await expect(guard.tryRun(fn)).rejects.toThrow("boom");

    const fn2 = vi.fn().mockResolvedValue(undefined);
    const started = await guard.tryRun(fn2);
    expect(started).toBe(true);
  });
});

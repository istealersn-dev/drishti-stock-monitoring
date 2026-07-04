import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSchedule, mockIsAgentPaused } = vi.hoisted(() => ({
  mockSchedule: vi.fn(),
  mockIsAgentPaused: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: { schedule: mockSchedule },
}));

vi.mock("../shared/env.js", () => ({
  env: {
    DRISHTI_POLL_INTERVAL_MINUTES: 5,
    DRISHTI_MARKET_OPEN: "00:00",
    DRISHTI_MARKET_CLOSE: "23:59",
  },
}));

vi.mock("../shared/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../features/settings/settings.service.js", () => ({
  isAgentPaused: mockIsAgentPaused,
}));

import { logger } from "../shared/logger.js";

import { startCron } from "./cron.js";

function getScheduledCallback(): () => void {
  const call = mockSchedule.mock.calls[0] as [string, () => void] | undefined;
  if (!call) throw new Error("cron.schedule was not called");
  return call[1];
}

describe("startCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAgentPaused.mockReturnValue(false);
  });

  it("skips a tick that fires while the previous tick is still in progress", async () => {
    let resolveFirstTick: () => void = () => {};
    const firstTickPromise = new Promise<void>((resolve) => {
      resolveFirstTick = resolve;
    });
    const tick = vi.fn().mockReturnValueOnce(firstTickPromise).mockResolvedValue(undefined);

    startCron(tick);
    const callback = getScheduledCallback();

    callback(); // first tick starts, still in-flight
    callback(); // second tick fires before the first resolves — should be skipped

    expect(tick).toHaveBeenCalledOnce();

    resolveFirstTick();
    await firstTickPromise;
    await Promise.resolve(); // let the .finally() run

    callback(); // now that the first tick finished, a new tick should run
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("skips the tick when the agent is paused", () => {
    mockIsAgentPaused.mockReturnValue(true);
    const tick = vi.fn().mockResolvedValue(undefined);

    startCron(tick);
    getScheduledCallback()();

    expect(tick).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith("Agent paused — skipping poll tick");
  });

  it("runs the tick normally when the agent is not paused", async () => {
    mockIsAgentPaused.mockReturnValue(false);
    const tick = vi.fn().mockResolvedValue(undefined);

    startCron(tick);
    getScheduledCallback()();
    await Promise.resolve();

    expect(tick).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFastRun, mockSlowRun, mockInsert, mockUpdate } = vi.hoisted(() => {
  const run = vi.fn();
  const values = vi.fn(() => ({ run }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(() => ({ run }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return {
    mockFastRun: vi.fn(),
    mockSlowRun: vi.fn(),
    mockInsert: insert,
    mockUpdate: update,
  };
});

vi.mock("./agent.graph.js", () => ({
  buildFastAgentGraph: vi.fn(() => ({ run: mockFastRun })),
  buildSlowAgentGraph: vi.fn(() => ({ run: mockSlowRun })),
}));

vi.mock("../../db/db.js", () => ({ db: { insert: mockInsert, update: mockUpdate } }));
vi.mock("../../shared/env.js", () => ({ env: { DRISHTI_DRY_RUN: false } }));

import type { AgentState } from "./agent.state.js";
import { tick, runSlowPhase } from "./agent.tick.js";

function makeFastState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    runId: "run-1",
    holdings: [{ trading_symbol: "TCS-EQ" } as never],
    ltpMap: {},
    slConfigs: [],
    breaches: [],
    targetHits: [],
    llmOutput: null,
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tick", () => {
  it("dispatches the slow phase without awaiting it, so tick() resolves before slow phase completes", async () => {
    mockFastRun.mockResolvedValue(makeFastState());
    let slowResolve: (() => void) | undefined;
    mockSlowRun.mockReturnValue(
      new Promise<void>((resolve) => {
        slowResolve = resolve;
      }),
    );

    await tick();

    expect(mockFastRun).toHaveBeenCalledOnce();
    expect(mockSlowRun).toHaveBeenCalledOnce();

    slowResolve?.();
  });

  it("does not dispatch the slow phase when the fast phase has errors", async () => {
    mockFastRun.mockResolvedValue(makeFastState({ errors: ["fetch_holdings: boom"] }));

    await tick();

    expect(mockSlowRun).not.toHaveBeenCalled();
  });

  it("does not dispatch the slow phase when there are no holdings", async () => {
    mockFastRun.mockResolvedValue(makeFastState({ holdings: [] }));

    await tick();

    expect(mockSlowRun).not.toHaveBeenCalled();
  });
});

describe("runSlowPhase", () => {
  it("skips starting a new slow phase while one is already in progress", async () => {
    let resolveFirst: (() => void) | undefined;
    mockSlowRun.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const state = makeFastState();
    const first = runSlowPhase(state);
    const second = runSlowPhase(state);
    await second;

    expect(mockSlowRun).toHaveBeenCalledOnce();

    resolveFirst?.();
    await first;
  });

  it("allows a new slow phase to start once the previous one has completed", async () => {
    mockSlowRun.mockResolvedValue(undefined);

    await runSlowPhase(makeFastState());
    await runSlowPhase(makeFastState());

    expect(mockSlowRun).toHaveBeenCalledTimes(2);
  });

  it("catches an error from the slow graph without throwing, and releases the guard", async () => {
    mockSlowRun.mockRejectedValueOnce(new Error("llm boom"));

    await expect(runSlowPhase(makeFastState())).resolves.toBeUndefined();

    mockSlowRun.mockResolvedValueOnce(undefined);
    await runSlowPhase(makeFastState());
    expect(mockSlowRun).toHaveBeenCalledTimes(2);
  });
});

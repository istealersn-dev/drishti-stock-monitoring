import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClassifyIntent, mockSubmitBuyInstruction, mockHandleAsk, mockStoreSlackSession } =
  vi.hoisted(() => ({
    mockClassifyIntent: vi.fn(),
    mockSubmitBuyInstruction: vi.fn(),
    mockHandleAsk: vi.fn(),
    mockStoreSlackSession: vi.fn(),
  }));

vi.mock("../instructions/instructions.intent.js", () => ({
  classifyIntent: mockClassifyIntent,
}));

vi.mock("../instructions/instructions.pipeline.js", () => ({
  submitBuyInstruction: mockSubmitBuyInstruction,
}));

vi.mock("./slackCommands.handlers.js", () => ({
  handleAnalyse: vi.fn(),
  handleAsk: mockHandleAsk,
  handleGtts: vi.fn(),
  handleHealth: vi.fn(),
  handleHelp: vi.fn(),
  handleHoldings: vi.fn(),
  handlePnl: vi.fn(),
  handleSetup: vi.fn(),
  handleStatus: vi.fn(),
  handleWatchlistAdd: vi.fn(),
  handleWatchlistList: vi.fn(),
  handleWatchlistRemove: vi.fn(),
  storeSlackSession: mockStoreSlackSession,
}));

vi.mock("./slackCommands.command.js", () => ({ routeCommand: vi.fn().mockReturnValue(null) }));

vi.mock("../../db/db.js", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
      }),
    }),
  },
}));

vi.mock("../../shared/env.js", () => ({
  env: { SLACK_ALERT_CHANNEL_ID: "C_ALERTS" },
}));

import { registerSlackCommands } from "./slackCommands.router.js";

type EventHandler = (arguments_: {
  event: unknown;
  say: (message: unknown) => Promise<unknown>;
  client: unknown;
}) => Promise<void>;

function buildFakeApp(): {
  app: {
    event: ReturnType<typeof vi.fn>;
    message: ReturnType<typeof vi.fn>;
    command: ReturnType<typeof vi.fn>;
  };
  eventHandlers: Record<string, EventHandler>;
} {
  const eventHandlers: Record<string, EventHandler> = {};
  const app = {
    event: vi.fn((name: string, handler: EventHandler) => {
      eventHandlers[name] = handler;
    }),
    message: vi.fn(),
    command: vi.fn(),
  };
  return { app, eventHandlers };
}

describe("app_mention handler", () => {
  const say = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    say.mockResolvedValue(undefined);
  });

  it("routes to submitBuyInstruction when intent is ORDER", async () => {
    mockClassifyIntent.mockResolvedValue({ intent: "ORDER", clarifyingQuestion: null });
    mockSubmitBuyInstruction.mockResolvedValue({
      ok: true,
      approvalId: "a1",
      symbol: "RAMCOSYS-EQ",
    });

    const { app, eventHandlers } = buildFakeApp();
    registerSlackCommands(app as never, "C_CMD");

    await eventHandlers.app_mention?.({
      event: {
        text: "<@U1> Ramco Systems Buy 560-580 SL 520 Tgt 680 800+",
        channel: "C1",
        ts: "100.1",
      },
      say,
      client: {},
    });

    expect(mockSubmitBuyInstruction).toHaveBeenCalledWith(
      "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+",
      "C1",
    );
    expect(mockHandleAsk).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Approval card sent") }),
    );
  });

  it("asks a clarifying question when intent is AMBIGUOUS, never calls handleAsk or submitBuyInstruction, but still tracks the thread", async () => {
    mockClassifyIntent.mockResolvedValue({
      intent: "AMBIGUOUS",
      clarifyingQuestion: "Do you want to buy Ramco Systems, or ask about it?",
    });

    const { app, eventHandlers } = buildFakeApp();
    registerSlackCommands(app as never, "C_CMD");

    await eventHandlers.app_mention?.({
      event: { text: "<@U1> Ramco Systems", channel: "C1", ts: "100.2" },
      say,
      client: {},
    });

    expect(mockSubmitBuyInstruction).not.toHaveBeenCalled();
    expect(mockHandleAsk).not.toHaveBeenCalled();
    expect(mockStoreSlackSession).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Do you want to buy Ramco Systems, or ask about it?" }),
    );
  });

  it("falls back to the generic clarifying question when the LLM returns an empty string", async () => {
    mockClassifyIntent.mockResolvedValue({ intent: "AMBIGUOUS", clarifyingQuestion: "" });

    const { app, eventHandlers } = buildFakeApp();
    registerSlackCommands(app as never, "C_CMD");

    await eventHandlers.app_mention?.({
      event: { text: "<@U1> Ramco Systems", channel: "C1", ts: "100.5" },
      say,
      client: {},
    });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Is this a buy instruction or a question? Rephrase and I'll help.",
      }),
    );
  });

  it("tracks the thread when intent is ORDER so a follow-up reply isn't silently dropped", async () => {
    mockClassifyIntent.mockResolvedValue({ intent: "ORDER", clarifyingQuestion: null });
    mockSubmitBuyInstruction.mockResolvedValue({
      ok: true,
      approvalId: "a2",
      symbol: "RAMCOSYS-EQ",
    });

    const { app, eventHandlers } = buildFakeApp();
    registerSlackCommands(app as never, "C_CMD");

    await eventHandlers.app_mention?.({
      event: {
        text: "<@U1> Ramco Systems Buy 560-580 SL 520 Tgt 680 800+",
        channel: "C1",
        ts: "100.6",
      },
      say,
      client: {},
    });

    expect(mockStoreSlackSession).toHaveBeenCalled();
  });

  it("falls through to handleAsk when intent is QUERY", async () => {
    mockClassifyIntent.mockResolvedValue({ intent: "QUERY", clarifyingQuestion: null });
    mockHandleAsk.mockResolvedValue({ ts: "100.4", channel: "C1" });

    const { app, eventHandlers } = buildFakeApp();
    registerSlackCommands(app as never, "C_CMD");

    await eventHandlers.app_mention?.({
      event: { text: "<@U1> how's Ramco doing", channel: "C1", ts: "100.3" },
      say,
      client: {},
    });

    expect(mockSubmitBuyInstruction).not.toHaveBeenCalled();
    expect(mockHandleAsk).toHaveBeenCalled();
    expect(mockStoreSlackSession).toHaveBeenCalled();
  });
});

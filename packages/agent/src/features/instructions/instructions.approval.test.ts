import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPostMessage = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_ALERT_CHANNEL_ID: "C123456",
    DRISHTI_APPROVAL_TIMEOUT_MINUTES: 10,
  },
}));

import { sendApprovalCard } from "./instructions.approval.js";
import type { ParsedInstruction } from "./instructions.schema.js";

const instruction: ParsedInstruction = {
  stockName: "Ramco Systems",
  action: "BUY",
  entryLow: 560,
  entryHigh: 580,
  stopLoss: 520,
  targets: [
    { price: 680, isOpenEnded: false },
    { price: 800, isOpenEnded: true },
  ],
};

function blocksFromCall(): { type: string; text?: { text: string } }[] {
  const call = mockPostMessage.mock.calls[0]?.[0] as {
    blocks: { type: string; text?: { text: string } }[];
  };
  return call.blocks;
}

describe("sendApprovalCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostMessage.mockResolvedValue({ ok: true, ts: "1111111111.000001" });
  });

  it("includes an AI Analysis block when analysis text is provided", async () => {
    await sendApprovalCard(
      "approval-1",
      instruction,
      "RAMCOSYS-EQ",
      100,
      50_000,
      "R:R looks reasonable, no major news flagged.",
    );

    const blocks = blocksFromCall();
    const analysisBlock = blocks.find((block) => block.text?.text.includes("AI Analysis"));
    expect(analysisBlock).toBeDefined();
    expect(analysisBlock?.text?.text).toContain("R:R looks reasonable");
  });

  it("omits the AI Analysis block when analysis is null", async () => {
    await sendApprovalCard("approval-2", instruction, "RAMCOSYS-EQ", 100, 50_000, null);

    const blocks = blocksFromCall();
    const analysisBlock = blocks.find((block) => block.text?.text.includes("AI Analysis"));
    expect(analysisBlock).toBeUndefined();
  });
});

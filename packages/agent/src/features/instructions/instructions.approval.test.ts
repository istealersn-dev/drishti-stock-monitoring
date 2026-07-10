import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPostMessage = vi.fn();
const mockChatUpdate = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage, update: mockChatUpdate },
  })),
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_ALERT_CHANNEL_ID: "C123456",
    DRISHTI_APPROVAL_TIMEOUT_MINUTES: 10,
  },
}));

import {
  buildEditAmountModal,
  parseEditAmountSubmission,
  refreshApprovalCard,
  sendApprovalCard,
} from "./instructions.approval.js";
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

type MockBlock = {
  type: string;
  text?: { text: string };
  elements?: { action_id?: string }[];
};

function blocksFromCall(): MockBlock[] {
  const call = mockPostMessage.mock.calls[0]?.[0] as { blocks: MockBlock[] };
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

  it("includes a flagged warning block when actionDisagreement is set", async () => {
    await sendApprovalCard("approval-3", instruction, "RAMCOSYS-EQ", 100, 50_000, null, "SELL");

    const blocks = blocksFromCall();
    const flagBlock = blocks.find((block) => block.text?.text.includes("Flagged"));
    expect(flagBlock).toBeDefined();
    expect(flagBlock?.text?.text).toContain("SELL");
  });

  it("escapes Slack mrkdwn special characters and strips backticks from actionDisagreement", async () => {
    const payload = "SELL`<https://evil.example|x>";
    await sendApprovalCard("approval-5", instruction, "RAMCOSYS-EQ", 100, 50_000, null, payload);

    const blocks = blocksFromCall();
    const flagBlock = blocks.find((block) => block.text?.text.includes("Flagged"));
    expect(flagBlock).toBeDefined();
    const text = flagBlock?.text?.text ?? "";
    expect(text).not.toContain("<https://evil.example|x>");
    expect(text).not.toContain("`<");
    expect(text).toContain("&lt;https://evil.example|x&gt;");
  });

  it("omits the flagged warning block when actionDisagreement is null", async () => {
    await sendApprovalCard("approval-4", instruction, "RAMCOSYS-EQ", 100, 50_000, null, null);

    const blocks = blocksFromCall();
    const flagBlock = blocks.find((block) => block.text?.text.includes("Flagged"));
    expect(flagBlock).toBeUndefined();
  });

  it("includes an Edit Amount button alongside Approve/Reject", async () => {
    await sendApprovalCard("approval-6", instruction, "RAMCOSYS-EQ", 100, 50_000, null);

    const blocks = blocksFromCall();
    const actionsBlock = blocks.find((block) => block.type === "actions");
    const actionIds = actionsBlock?.elements?.map((element) => element.action_id);
    expect(actionIds).toEqual(["approve_buy", "edit_amount", "reject_buy"]);
  });
});

describe("refreshApprovalCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatUpdate.mockResolvedValue({ ok: true });
  });

  it("updates the message in place with the new qty and no analysis block", async () => {
    const result = await refreshApprovalCard(
      "1111111111.000001",
      "approval-1",
      instruction,
      "RAMCOSYS-EQ",
      42,
      50_000,
      null,
    );

    expect(result.ok).toBe(true);
    const call = mockChatUpdate.mock.calls[0]?.[0] as {
      ts: string;
      blocks: { type: string; text?: { text: string }; fields?: { text: string }[] }[];
    };
    expect(call.ts).toBe("1111111111.000001");
    expect(call.blocks.some((block) => block.text?.text.includes("AI Analysis"))).toBe(false);
    const fieldsBlock = call.blocks.find((block) => block.fields);
    expect(fieldsBlock?.fields?.some((field) => field.text.includes("42 shares"))).toBe(true);
  });

  it("preserves the actionDisagreement warning block when passed through", async () => {
    const result = await refreshApprovalCard(
      "1111111111.000001",
      "approval-1",
      instruction,
      "RAMCOSYS-EQ",
      42,
      50_000,
      "SELL",
    );

    expect(result.ok).toBe(true);
    const call = mockChatUpdate.mock.calls[0]?.[0] as {
      blocks: { type: string; text?: { text: string } }[];
    };
    const flagBlock = call.blocks.find((block) => block.text?.text.includes("Flagged"));
    expect(flagBlock).toBeDefined();
    expect(flagBlock?.text?.text).toContain("SELL");
  });

  it("returns a SlackError when chat.update rejects", async () => {
    mockChatUpdate.mockRejectedValue(new Error("channel_not_found"));

    const result = await refreshApprovalCard(
      "1111111111.000001",
      "approval-1",
      instruction,
      "RAMCOSYS-EQ",
      42,
      50_000,
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("channel_not_found");
  });
});

describe("buildEditAmountModal", () => {
  it("pre-fills the amount input with the rounded current amount", () => {
    const view = buildEditAmountModal("approval-1", 49_999.6) as {
      private_metadata: string;
      blocks: { element: { initial_value: string } }[];
    };

    expect(view.private_metadata).toBe("approval-1");
    expect(view.blocks[0]?.element.initial_value).toBe("50000");
  });
});

describe("parseEditAmountSubmission", () => {
  const baseView = (
    values: Record<string, unknown>,
  ): Parameters<typeof parseEditAmountSubmission>[0] =>
    ({
      private_metadata: "approval-1",
      state: { values },
    }) as Parameters<typeof parseEditAmountSubmission>[0];

  it("extracts a valid positive amount", () => {
    const view = baseView({ amount_block: { amount_input: { value: "50000" } } });
    const result = parseEditAmountSubmission(view);
    expect(result).toEqual({ ok: true, approvalId: "approval-1", amountInr: 50_000 });
  });

  it("rejects a blank amount", () => {
    const view = baseView({ amount_block: { amount_input: { value: "" } } });
    const result = parseEditAmountSubmission(view);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const view = baseView({ amount_block: { amount_input: { value: "abc" } } });
    const result = parseEditAmountSubmission(view);
    expect(result.ok).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    const view = baseView({ amount_block: { amount_input: { value: "0" } } });
    const result = parseEditAmountSubmission(view);
    expect(result.ok).toBe(false);
  });
});

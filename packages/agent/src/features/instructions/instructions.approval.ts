import { WebClient } from "@slack/web-api";

import { env } from "../../shared/env.js";
import { SlackError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import type { ParsedInstruction } from "./instructions.schema.js";

let _client: WebClient | undefined;

function getClient(): WebClient {
  if (!_client) {
    _client = new WebClient(env.SLACK_BOT_TOKEN);
  }
  return _client;
}

function formatTargets(instruction: ParsedInstruction): string {
  if (instruction.targets.length === 0) return "—";
  return instruction.targets
    .map((target, index) => `T${index + 1} ₹${target.price}${target.isOpenEnded ? "+" : ""}`)
    .join(" · ");
}

function formatEntry(instruction: ParsedInstruction): string {
  if (!instruction.entryLow || !instruction.entryHigh) return "—";
  if (instruction.entryLow === instruction.entryHigh) return `₹${instruction.entryLow}`;
  return `₹${instruction.entryLow} – ₹${instruction.entryHigh}`;
}

/**
 * Build and post a Slack Block Kit approval card for a buy instruction.
 * @param approvalId - UUID used as the action value so Bolt can correlate the tap
 * @param instruction - The parsed buy instruction
 * @param resolvedSymbol - The Upstox trading symbol (e.g. "RAMCOSYS-EQ")
 * @param suggestedQty - Agent-calculated suggested quantity
 * @param availableMargin - Current available margin in rupees
 * @param analysis - AI sanity-check text for the setup, or null if analysis was unavailable
 * @returns A Result containing the Slack message timestamp or a SlackError
 */
export async function sendApprovalCard(
  approvalId: string,
  instruction: ParsedInstruction,
  resolvedSymbol: string,
  suggestedQty: number,
  availableMargin: number,
  analysis: string | null,
): Promise<Result<string, SlackError>> {
  const timeoutMinutes = env.DRISHTI_APPROVAL_TIMEOUT_MINUTES;

  const analysisBlock = analysis
    ? [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*AI Analysis:*\n${analysis}` },
        },
      ]
    : [];

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🟡 Buy Instruction — Awaiting Approval", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Stock:*\n${resolvedSymbol}` },
        { type: "mrkdwn", text: `*Action:*\nBUY` },
        { type: "mrkdwn", text: `*Entry:*\n${formatEntry(instruction)}` },
        {
          type: "mrkdwn",
          text: `*Stop Loss:*\n${instruction.stopLoss ? `₹${instruction.stopLoss}` : "—"}`,
        },
        { type: "mrkdwn", text: `*Targets:*\n${formatTargets(instruction)}` },
        { type: "mrkdwn", text: `*Suggested Qty:*\n${suggestedQty} shares` },
        {
          type: "mrkdwn",
          text: `*Available Margin:*\n₹${availableMargin.toLocaleString("en-IN")}`,
        },
      ],
    },
    ...analysisBlock,
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "✅ Approve", emoji: true },
          style: "primary",
          action_id: "approve_buy",
          value: approvalId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "❌ Reject", emoji: true },
          style: "danger",
          action_id: "reject_buy",
          value: approvalId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Expires in ${timeoutMinutes} minutes. No action = auto-reject.`,
        },
      ],
    },
  ];

  try {
    const response = await getClient().chat.postMessage({
      channel: env.SLACK_ALERT_CHANNEL_ID,
      text: `🟡 Buy Instruction for ${resolvedSymbol} — awaiting approval`,
      blocks,
    });

    if (!response.ok) {
      return err(new SlackError(`Slack API error: ${response.error ?? "unknown"}`));
    }
    return ok(response.ts ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new SlackError(`Failed to post approval card: ${message}`));
  }
}

/**
 * Update an existing approval card to show the resolved status.
 * @param slackTs - The original message timestamp to update
 * @param resolvedSymbol - The trading symbol
 * @param status - "approved" | "rejected" | "expired"
 * @returns A Result indicating success, or a SlackError if the update call fails
 */
export async function updateApprovalCard(
  slackTs: string,
  resolvedSymbol: string,
  status: "approved" | "rejected" | "expired",
): Promise<Result<void, SlackError>> {
  const emoji = status === "approved" ? "✅" : "❌";
  const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Expired";

  try {
    await getClient().chat.update({
      channel: env.SLACK_ALERT_CHANNEL_ID,
      ts: slackTs,
      text: `${emoji} Buy instruction for ${resolvedSymbol} — ${label}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *Buy Instruction for ${resolvedSymbol} — ${label}*`,
          },
        },
      ],
    });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new SlackError(`Failed to update approval card: ${message}`));
  }
}

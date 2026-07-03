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

/**
 * Format an instruction's targets as "T1 ₹680 · T2 ₹800+", or "—" if none.
 * @param instruction - The parsed buy instruction
 * @returns The formatted targets string
 */
export function formatTargets(instruction: ParsedInstruction): string {
  if (instruction.targets.length === 0) return "—";
  return instruction.targets
    .map((target, index) => `T${index + 1} ₹${target.price}${target.isOpenEnded ? "+" : ""}`)
    .join(" · ");
}

/**
 * Format an instruction's entry range as "₹560 – ₹580" (or a single "₹570" when
 * entryLow equals entryHigh), or "—" if either bound is missing.
 * @param instruction - The parsed buy instruction
 * @returns The formatted entry string
 */
export function formatEntry(instruction: ParsedInstruction): string {
  if (!instruction.entryLow || !instruction.entryHigh) return "—";
  if (instruction.entryLow === instruction.entryHigh) return `₹${instruction.entryLow}`;
  return `₹${instruction.entryLow} – ₹${instruction.entryHigh}`;
}

/**
 * Format an instruction's stop loss as "₹520", or "—" if missing.
 * @param instruction - The parsed buy instruction
 * @returns The formatted stop-loss string
 */
export function formatStopLoss(instruction: ParsedInstruction): string {
  return instruction.stopLoss ? `₹${instruction.stopLoss}` : "—";
}

/**
 * Build and post a Slack Block Kit approval card for a buy instruction.
 * @param approvalId - UUID used as the action value so Bolt can correlate the tap
 * @param instruction - The parsed buy instruction
 * @param resolvedSymbol - The Upstox trading symbol (e.g. "RAMCOSYS-EQ")
 * @param suggestedQty - Agent-calculated suggested quantity
 * @param availableMargin - Current available margin in rupees
 * @param analysis - AI sanity-check text for the setup, or null if analysis was unavailable
 * @param actionDisagreement - Non-null when the parser's model disagreed with the
 *   forced BUY action (e.g. extracted "SELL"/"EXIT"), surfaced as a warning block
 *   so the approver sees the anomaly before deciding
 * @returns A Result containing the Slack message timestamp or a SlackError
 */
export async function sendApprovalCard(
  approvalId: string,
  instruction: ParsedInstruction,
  resolvedSymbol: string,
  suggestedQty: number,
  availableMargin: number,
  analysis: string | null,
  actionDisagreement: string | null = null,
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

  const disagreementBlock = actionDisagreement
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🚩 *Flagged:* The parser's model extracted action=\`${actionDisagreement}\` for this text, not BUY. Double-check this is really a buy instruction before approving.`,
          },
        },
      ]
    : [];

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🟡 Buy Instruction — Awaiting Approval", emoji: true },
    },
    ...disagreementBlock,
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Stock:*\n${resolvedSymbol}` },
        { type: "mrkdwn", text: `*Action:*\nBUY` },
        { type: "mrkdwn", text: `*Entry:*\n${formatEntry(instruction)}` },
        { type: "mrkdwn", text: `*Stop Loss:*\n${formatStopLoss(instruction)}` },
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

import type { ViewOutput } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import { WebClient } from "@slack/web-api";
import type { ViewsOpenArguments } from "@slack/web-api";

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

const MAX_DISAGREEMENT_LENGTH = 40;

/**
 * Escape Slack mrkdwn special characters and strip backticks from a value
 * that will be interpolated into a mrkdwn block, so it can't break out of the
 * surrounding formatting or inject a link (`<url|label>`). Slack's own mrkdwn
 * escaping only requires `&`/`<`/`>`; backticks are additionally stripped
 * here since they aren't escapable and could otherwise close the code span
 * early. Also truncates, since the source (the parser LLM's raw "action"
 * field extraction from user-supplied instruction text — see
 * instructions.parser.ts) is unconstrained free text, not a fixed enum.
 * @param value - The raw value to render inside a Slack mrkdwn block
 * @returns The escaped, truncated value
 */
function escapeForApprovalCard(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`/g, "");
  return escaped.length > MAX_DISAGREEMENT_LENGTH
    ? `${escaped.slice(0, MAX_DISAGREEMENT_LENGTH)}…`
    : escaped;
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
 * Build the Block Kit blocks for a pending approval card. Shared by the initial
 * post (sendApprovalCard) and an in-place refresh after the approver edits the
 * amount (refreshApprovalCard) so the two can't drift in layout.
 * @param approvalId - UUID used as the action value so Bolt can correlate taps
 * @param instruction - The parsed buy instruction
 * @param resolvedSymbol - The Upstox trading symbol (e.g. "RAMCOSYS-EQ")
 * @param qty - Quantity to display (suggested, or approver-overridden)
 * @param availableMargin - Current available margin in rupees
 * @param analysis - AI sanity-check text for the setup, or null if unavailable.
 *   Dropped on a post-edit refresh rather than re-run, since re-invoking the LLM
 *   on every amount edit would make editing feel slow for no material benefit.
 * @param actionDisagreement - Non-null when the parser's model disagreed with the
 *   forced BUY action, surfaced as a warning block
 * @returns The card's Block Kit blocks array
 */
function buildApprovalCardBlocks(
  approvalId: string,
  instruction: ParsedInstruction,
  resolvedSymbol: string,
  qty: number,
  availableMargin: number,
  analysis: string | null,
  actionDisagreement: string | null,
): KnownBlock[] {
  const timeoutMinutes = env.DRISHTI_APPROVAL_TIMEOUT_MINUTES;

  const analysisBlock: KnownBlock[] = analysis
    ? [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*AI Analysis:*\n${analysis}` },
        },
      ]
    : [];

  const disagreementBlock: KnownBlock[] = actionDisagreement
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🚩 *Flagged:* The parser's model extracted action=\`${escapeForApprovalCard(actionDisagreement)}\` for this text, not BUY. Double-check this is really a buy instruction before approving.`,
          },
        },
      ]
    : [];

  return [
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
        { type: "mrkdwn", text: `*Qty:*\n${qty} shares` },
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
          text: { type: "plain_text", text: "✏️ Edit Amount", emoji: true },
          action_id: "edit_amount",
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
  const blocks = buildApprovalCardBlocks(
    approvalId,
    instruction,
    resolvedSymbol,
    suggestedQty,
    availableMargin,
    analysis,
    actionDisagreement,
  );

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
 * Re-render a still-pending approval card in place after the approver edits
 * the amount — same layout as sendApprovalCard, minus the AI analysis (see
 * buildApprovalCardBlocks), via chat.update instead of a new post.
 * @param slackTs - The original message timestamp to update
 * @param approvalId - UUID used as the action value so Bolt can correlate taps
 * @param instruction - The parsed buy instruction
 * @param resolvedSymbol - The Upstox trading symbol
 * @param qty - The new quantity to display
 * @param availableMargin - Freshly-fetched available margin in rupees
 * @returns A Result indicating success, or a SlackError if the update call fails
 */
export async function refreshApprovalCard(
  slackTs: string,
  approvalId: string,
  instruction: ParsedInstruction,
  resolvedSymbol: string,
  qty: number,
  availableMargin: number,
): Promise<Result<void, SlackError>> {
  const blocks = buildApprovalCardBlocks(
    approvalId,
    instruction,
    resolvedSymbol,
    qty,
    availableMargin,
    null,
    null,
  );

  try {
    await getClient().chat.update({
      channel: env.SLACK_ALERT_CHANNEL_ID,
      ts: slackTs,
      text: `🟡 Buy Instruction for ${resolvedSymbol} — awaiting approval`,
      blocks,
    });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new SlackError(`Failed to refresh approval card: ${message}`));
  }
}

const EDIT_AMOUNT_MODAL_CALLBACK_ID = "edit_amount_modal";
const EDIT_AMOUNT_BLOCK_ID = "amount_block";
const EDIT_AMOUNT_ACTION_ID = "amount_input";

/**
 * Build the "Edit Amount" modal view, pre-filled with the current estimated
 * order amount. Slack Block Kit only allows plain_text_input inside a modal
 * (not a regular posted message), so editing the qty inline on the card
 * itself isn't possible — this modal is the closest equivalent.
 * @param approvalId - Carried in private_metadata so the view-submission
 *   handler knows which approval to update
 * @param currentAmountInr - The current estimated amount, used as the
 *   pre-filled default
 * @returns A Slack modal view object suitable for views.open
 */
export function buildEditAmountModal(
  approvalId: string,
  currentAmountInr: number,
): NonNullable<ViewsOpenArguments["view"]> {
  return {
    type: "modal",
    callback_id: EDIT_AMOUNT_MODAL_CALLBACK_ID,
    private_metadata: approvalId,
    title: { type: "plain_text", text: "Edit Order Amount" },
    submit: { type: "plain_text", text: "Update" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: EDIT_AMOUNT_BLOCK_ID,
        label: { type: "plain_text", text: "Amount (₹)" },
        element: {
          type: "plain_text_input",
          action_id: EDIT_AMOUNT_ACTION_ID,
          initial_value: String(Math.round(currentAmountInr)),
        },
      },
    ],
  };
}

/**
 * Extract and validate the amount entered in the "Edit Amount" modal.
 * @param view - The Bolt view_submission payload's view object
 * @returns The approval ID and parsed amount, or an error message
 */
export function parseEditAmountSubmission(
  view: ViewOutput,
): { ok: true; approvalId: string; amountInr: number } | { ok: false; error: string } {
  const approvalId = view.private_metadata ?? "";
  const raw = view.state?.values[EDIT_AMOUNT_BLOCK_ID]?.[EDIT_AMOUNT_ACTION_ID]?.value ?? "";
  const amountInr = Number(raw);

  if (!approvalId) {
    return { ok: false, error: "Missing approval reference" };
  }
  if (!raw || !Number.isFinite(amountInr) || amountInr <= 0) {
    return { ok: false, error: "Enter a valid positive amount" };
  }
  return { ok: true, approvalId, amountInr };
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

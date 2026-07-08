import crypto from "node:crypto";

import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { createApproval, setApprovalSlackTs } from "../approval/approval.store.js";
import { fetchMargins } from "../portfolio/portfolio.tools.js";
import { validateConcentration } from "../validator/validator.concentration.js";
import { validateRiskReward } from "../validator/validator.rr.js";

import { analyzeBuyInstruction } from "./instructions.analysis.js";
import { sendApprovalCard } from "./instructions.approval.js";
import { calculateSuggestedQty } from "./instructions.executor.js";
import { parseInstruction } from "./instructions.parser.js";
import { resolveSymbol } from "./instructions.resolver.js";
import type { ParsedInstruction, ResolvedStock } from "./instructions.schema.js";

export type SubmitResult =
  { ok: true; approvalId: string; symbol: string } | { ok: false; error: string };

/** A buy instruction that has cleared parsing, symbol resolution, and the R:R gate. */
export type ValidatedInstruction = {
  instruction: ParsedInstruction;
  actionDisagreement: string | null;
  resolved: ResolvedStock;
};

export type ValidateResult =
  { ok: true; value: ValidatedInstruction } | { ok: false; error: string };

/**
 * Format a submitBuyInstruction result as the Slack reply text shown at both entry
 * points (the @mention classifier and the /drishti slash command), so the copy
 * can't drift between the two.
 * @param result - The result of submitBuyInstruction
 * @returns The Slack reply text
 */
export function formatSubmitResultMessage(result: SubmitResult): string {
  return result.ok
    ? `✅ Approval card sent for *${result.symbol}* — check <#${env.SLACK_ALERT_CHANNEL_ID}> to approve.`
    : `⚠️ Could not process instruction\n${result.error}`;
}

/**
 * Fast, deterministic-latency validation of a buy instruction: parse, resolve the
 * stock name to a tradable symbol, and check the R:R gate. Deliberately excludes the
 * slow, variable-latency work (LLM analysis, margin fetch, approval-card send) — this
 * is the part safe to await synchronously in an HTTP request handler, since none of
 * its steps carry the multi-round LLM tool-loop latency that made a public-tunnel
 * request hang for the UI (see processValidatedInstruction).
 * @param text - Raw instruction text in canonical format
 * @param channelId - Originating channel identifier for logging
 * @returns A ValidateResult with the validated instruction, or an error already
 *   pushed to Slack
 */
export async function validateBuyInstruction(
  text: string,
  channelId: string,
): Promise<ValidateResult> {
  logger.info("Buy instruction received", { channelId, text: text.slice(0, 100) });

  const parseResult = await parseInstruction(text);
  if (!parseResult.ok) {
    logger.error("Failed to parse buy instruction", { error: parseResult.error.message });
    await pushAlert(
      `⚠️ Could not parse instruction:\n\`${text.slice(0, 200)}\`\n${parseResult.error.message}`,
    );
    return { ok: false, error: parseResult.error.message };
  }

  const { instruction, actionDisagreement } = parseResult.value;

  const resolveResult = await resolveSymbol(instruction.stockName);
  if (!resolveResult.ok) {
    logger.error("Failed to resolve symbol", {
      stockName: instruction.stockName,
      error: resolveResult.error.message,
    });
    await pushAlert(
      `⚠️ Could not resolve symbol for *${instruction.stockName}*:\n${resolveResult.error.message}`,
    );
    return { ok: false, error: resolveResult.error.message };
  }

  const resolved = resolveResult.value;

  const rrResult = validateRiskReward(instruction);
  if (!rrResult.pass) {
    logger.warn("Trade rejected: R:R check failed", {
      symbol: resolved.tradingSymbol,
      reason: rrResult.reason,
    });
    await pushAlert(
      `❌ *Trade Rejected — R:R check failed*\nStock: *${resolved.tradingSymbol}*\n\n${rrResult.reason}`,
    );
    return { ok: false, error: rrResult.reason };
  }

  return { ok: true, value: { instruction, actionDisagreement, resolved } };
}

/**
 * Runs the slow, variable-latency remainder of the buy-instruction pipeline (LLM
 * analysis, margin fetch, concentration check, approval creation, Slack card send)
 * against an already-validated instruction. Every failure path pushes to Slack
 * itself — this is designed to be safe to call fire-and-forget (not awaited) from an
 * HTTP handler, since a caller not awaiting it has no other way to observe a failure.
 * @param validated - The result of a successful validateBuyInstruction call
 * @returns SubmitResult with approvalId on success
 */
export async function processValidatedInstruction(
  validated: ValidatedInstruction,
): Promise<SubmitResult> {
  const { instruction, actionDisagreement, resolved } = validated;

  const analysisResult = await analyzeBuyInstruction(instruction, resolved.tradingSymbol);
  const analysis = analysisResult.ok ? analysisResult.value : null;

  const marginResult = await fetchMargins();
  const availableMargin = marginResult.ok ? marginResult.value.available_margin : 0;
  const entryHigh = instruction.entryHigh ?? 0;
  const entryLow = instruction.entryLow ?? entryHigh;
  // Use the best available price reference — point-entry instructions only set entryLow
  const entryPrice = entryHigh > 0 ? entryHigh : entryLow;
  const suggestedQty =
    entryPrice > 0 ? calculateSuggestedQty(availableMargin, entryPrice, entryLow) : 1;

  if (entryPrice > 0 && suggestedQty > 0) {
    const concentrationResult = await validateConcentration(suggestedQty, entryPrice);
    if (!concentrationResult.pass) {
      logger.warn("Concentration warning — proceeding to approval", {
        symbol: resolved.tradingSymbol,
        reason: concentrationResult.reason,
      });
      await pushAlert(
        `⚠️ *Concentration Warning*\n\nStock: *${resolved.tradingSymbol}*\n${concentrationResult.reason}\n\nApproval card follows — review carefully.`,
      );
    }
  }

  const approvalId = crypto.randomUUID();

  createApproval({
    id: approvalId,
    symbol: resolved.tradingSymbol,
    parsedJson: JSON.stringify({ ...instruction, _instrumentToken: resolved.instrumentToken }),
    suggestedQty,
  });

  const cardResult = await sendApprovalCard(
    approvalId,
    instruction,
    resolved.tradingSymbol,
    suggestedQty,
    availableMargin,
    analysis,
    actionDisagreement,
  );
  if (!cardResult.ok) {
    logger.error("Failed to send approval card", { approvalId, error: cardResult.error.message });
    await pushAlert(
      `⚠️ Failed to post approval card for *${resolved.tradingSymbol}*: ${cardResult.error.message}`,
    );
    return { ok: false, error: cardResult.error.message };
  }

  setApprovalSlackTs(approvalId, cardResult.value);
  logger.info("Approval card sent", {
    approvalId,
    symbol: resolved.tradingSymbol,
    slackTs: cardResult.value,
  });

  return { ok: true, approvalId, symbol: resolved.tradingSymbol };
}

/**
 * Parse, resolve, and enqueue a buy instruction from any channel (Slack or UI).
 * Sends a Slack approval card. Does NOT execute until the user approves. Synchronous
 * convenience wrapper over validateBuyInstruction + processValidatedInstruction for
 * callers (Slack's @mention classifier and /drishti slash command) that want a single
 * awaited result — the UI's HTTP endpoint uses the two steps separately instead, since
 * awaiting the full pipeline over a public tunnel is what caused a stuck "sending..."
 * state (the slow half can run 44s-180s).
 * @param text - Raw instruction text in canonical format
 * @param channelId - Originating channel identifier for logging
 * @returns SubmitResult with approvalId on success
 */
export async function submitBuyInstruction(text: string, channelId: string): Promise<SubmitResult> {
  const validated = await validateBuyInstruction(text, channelId);
  if (!validated.ok) {
    return validated;
  }
  return processValidatedInstruction(validated.value);
}

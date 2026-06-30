import crypto from "node:crypto";

import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { createApproval, setApprovalSlackTs } from "../approval/approval.store.js";
import { fetchMargins } from "../portfolio/portfolio.tools.js";
import { validateConcentration } from "../validator/validator.concentration.js";
import { validateRiskReward } from "../validator/validator.rr.js";

import { sendApprovalCard } from "./instructions.approval.js";
import { calculateSuggestedQty } from "./instructions.executor.js";
import { parseInstruction } from "./instructions.parser.js";
import { resolveSymbol } from "./instructions.resolver.js";

export type SubmitResult =
  { ok: true; approvalId: string; symbol: string } | { ok: false; error: string };

/**
 * Parse, resolve, and enqueue a buy instruction from any channel (Slack or UI).
 * Sends a Slack approval card. Does NOT execute until the user approves.
 * @param text - Raw instruction text in canonical format
 * @param channelId - Originating channel identifier for logging
 * @returns SubmitResult with approvalId on success
 */
export async function submitBuyInstruction(text: string, channelId: string): Promise<SubmitResult> {
  logger.info("Buy instruction received", { channelId, text: text.slice(0, 100) });

  const parseResult = await parseInstruction(text);
  if (!parseResult.ok) {
    logger.error("Failed to parse buy instruction", { error: parseResult.error.message });
    await pushAlert(
      `⚠️ Could not parse instruction:\n\`${text.slice(0, 200)}\`\n${parseResult.error.message}`,
    );
    return { ok: false, error: parseResult.error.message };
  }

  const instruction = parseResult.value;

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
      `❌ *Trade Rejected — R:R check failed*\n\nStock: *${resolved.tradingSymbol}*\nReason: ${rrResult.reason}`,
    );
    return { ok: false, error: rrResult.reason };
  }

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

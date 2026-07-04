import crypto from "node:crypto";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders, stockConfig } from "../../db/schema.js";
import { isDryRunActive } from "../../shared/dryRun.js";
import { logger } from "../../shared/logger.js";
import { resolveApproval, getApproval } from "../approval/approval.store.js";
import { createGTT } from "../gtt/gtt.tools.js";
import { fetchMargins } from "../portfolio/portfolio.tools.js";

import { updateApprovalCard } from "./instructions.approval.js";
import { ParsedInstructionSchema } from "./instructions.schema.js";

const BUY_LIMIT_BUFFER = 1.005;
const MIN_QUANTITY = 1;

/**
 * Calculate suggested buy quantity from available margin and entry price.
 * Uses the midpoint of the entry range (or entryHigh if no range).
 * @param availableMargin - Available cash/margin in rupees
 * @param entryHigh - Upper bound of the entry range
 * @param entryLow - Lower bound of the entry range (defaults to entryHigh)
 * @returns Suggested number of shares (minimum 1)
 */
export function calculateSuggestedQty(
  availableMargin: number,
  entryHigh: number,
  entryLow: number = entryHigh,
): number {
  const midpoint = (entryLow + entryHigh) / 2;
  return Math.max(MIN_QUANTITY, Math.floor(availableMargin / midpoint));
}

/**
 * Execute an approved buy instruction: fetch margin, create GTT, write DB rows.
 * When DRISHTI_DRY_RUN=true, skips the Upstox GTT API call but writes all DB records.
 * @param approvalId - The UUID of the approved pending_approval row
 * @param runId - Current agent run ID for log correlation
 * @returns A Result indicating success or the error message
 */
export async function executeApprovedInstruction(
  approvalId: string,
  runId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const approval = getApproval(approvalId);

  if (!approval) {
    return { ok: false, error: `Approval ${approvalId} not found` };
  }

  if (approval.status !== "pending") {
    return { ok: false, error: `Approval ${approvalId} is already ${approval.status}` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(approval.parsedJson);
  } catch {
    return { ok: false, error: "Failed to parse stored instruction JSON" };
  }

  const rawRecord = raw as Record<string, unknown>;
  const instrumentToken =
    typeof rawRecord._instrumentToken === "string" ? rawRecord._instrumentToken : null;

  if (!instrumentToken) {
    return {
      ok: false,
      error: `Cannot execute ${approval.symbol}: instrument token missing from approval payload`,
    };
  }

  const parsedResult = ParsedInstructionSchema.safeParse(raw);
  if (!parsedResult.success) {
    return {
      ok: false,
      error: `Stored instruction failed validation: ${parsedResult.error.message}`,
    };
  }

  const instruction = parsedResult.data;
  if (!instruction.entryHigh) {
    return {
      ok: false,
      error: `Cannot execute ${approval.symbol}: entryHigh missing from instruction`,
    };
  }
  const entryHigh = instruction.entryHigh;
  const entryLow = instruction.entryLow ?? entryHigh;

  const marginResult = await fetchMargins();
  let qty = approval.suggestedQty;
  if (marginResult.ok) {
    qty = calculateSuggestedQty(marginResult.value.available_margin, entryHigh, entryLow);
  } else {
    logger.warn("Failed to fetch margins for qty calculation; using stored qty", {
      approvalId,
      error: marginResult.error.message,
    });
  }

  const limitPrice = Number((entryHigh * BUY_LIMIT_BUFFER).toFixed(2));

  const dryRun = isDryRunActive();
  const gttResult = await createGTT(
    {
      transaction_type: "BUY",
      trading_symbol: approval.symbol,
      exchange: "NSE",
      instrument_token: instrumentToken,
      product: "D",
      quantity: qty,
      order_type: "LIMIT",
      trigger_price: entryHigh,
      limit_price: limitPrice,
    },
    dryRun,
  );

  if (!gttResult.ok) {
    db.insert(agentLogs)
      .values({
        runId,
        symbol: approval.symbol,
        action: "buy_entry_gtt_failed",
        reasoning: `Buy GTT failed for ${approval.symbol}: ${gttResult.error.message}`,
        dryRun,
        error: gttResult.error.message,
        createdAt: now,
      })
      .run();
    logger.error("Buy GTT creation failed", {
      approvalId,
      symbol: approval.symbol,
      error: gttResult.error.message,
    });
    return { ok: false, error: gttResult.error.message };
  }

  const gttRowId = crypto.randomUUID();
  db.insert(gttOrders)
    .values({
      id: gttRowId,
      symbol: approval.symbol,
      type: "buy_entry",
      triggerPrice: entryHigh,
      limitPrice,
      quantity: qty,
      status: dryRun ? "dry_run" : "active",
      approvalId,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const slThreshold = instruction.stopLoss ?? 0;
  db.insert(stockConfig)
    .values({
      symbol: approval.symbol,
      slThreshold,
      targetOne: instruction.targets[0]?.price ?? null,
      targetTwo: instruction.targets[1]?.price ?? null,
      targetTwoOpen: instruction.targets[1]?.isOpenEnded ?? false,
      entryLow,
      entryHigh,
      buyPrice: entryHigh,
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: stockConfig.symbol,
      set: {
        slThreshold,
        targetOne: instruction.targets[0]?.price ?? null,
        targetTwo: instruction.targets[1]?.price ?? null,
        targetTwoOpen: instruction.targets[1]?.isOpenEnded ?? false,
        entryLow,
        entryHigh,
        buyPrice: entryHigh,
        isActive: true,
        updatedAt: now,
      },
    })
    .run();

  resolveApproval(approvalId, "approved");

  db.insert(agentLogs)
    .values({
      runId,
      symbol: approval.symbol,
      action: "buy_entry_gtt_created",
      reasoning: `Buy GTT placed for ${approval.symbol} at ₹${entryHigh}. ${gttResult.value}`,
      dryRun,
      error: null,
      createdAt: now,
    })
    .run();

  logger.info("Buy instruction executed", {
    approvalId,
    symbol: approval.symbol,
    qty,
    entryHigh,
    dryRun,
  });

  if (approval.slackTs) {
    const updateResult = await updateApprovalCard(approval.slackTs, approval.symbol, "approved");
    if (!updateResult.ok) {
      logger.warn("Failed to update approval card after execution", {
        approvalId,
        error: updateResult.error.message,
      });
    }
  }

  return { ok: true };
}

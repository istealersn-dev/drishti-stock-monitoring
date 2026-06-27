import crypto from "node:crypto";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { buildSlExitRequest } from "../gtt/gtt.service.js";
import { createGTT } from "../gtt/gtt.tools.js";

import type { SlBreach } from "./stopLoss.detector.js";

/**
 * Handle a single stop-loss breach: create a GTT exit order, alert Slack, and log to DB.
 * When DRISHTI_DRY_RUN=true, the GTT API call is skipped but all logs and DB rows are written.
 * @param breach - The detected SL breach
 * @param runId - Current agent run ID for log correlation
 */
export async function handleSlBreach(breach: SlBreach, runId: string): Promise<void> {
  const { holding, lastTradedPrice, slThreshold } = breach;
  const now = new Date().toISOString();

  const request = buildSlExitRequest(holding, slThreshold);
  const gttResult = await createGTT(request);

  const gttRowId = crypto.randomUUID();
  db.insert(gttOrders)
    .values({
      id: gttRowId,
      symbol: holding.trading_symbol,
      type: "sl_exit",
      triggerPrice: slThreshold,
      limitPrice: request.limit_price,
      quantity: holding.quantity,
      status: "active",
      approvalId: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const reasoning = gttResult.ok
    ? `LTP ₹${lastTradedPrice} breached SL ₹${slThreshold}. GTT: ${gttResult.value}`
    : `LTP ₹${lastTradedPrice} breached SL ₹${slThreshold}. GTT create failed: ${gttResult.error.message}`;

  db.insert(agentLogs)
    .values({
      runId,
      symbol: holding.trading_symbol,
      action: "sl_exit_gtt_created",
      reasoning,
      dryRun: env.DRISHTI_DRY_RUN,
      error: gttResult.ok ? null : gttResult.error.message,
      createdAt: now,
    })
    .run();

  logger.info("SL breach handled", {
    symbol: holding.trading_symbol,
    lastTradedPrice,
    slThreshold,
    dryRun: env.DRISHTI_DRY_RUN,
    gttOk: gttResult.ok,
  });

  const dryRunNote = env.DRISHTI_DRY_RUN ? " ⚠️ *DRY RUN — no GTT placed*" : "";
  const alertMessage = [
    `🚨 *SL BREACH — ${holding.trading_symbol}*`,
    `LTP: ₹${lastTradedPrice}  |  SL: ₹${slThreshold}  |  Qty: ${holding.quantity}`,
    gttResult.ok
      ? `✅ GTT exit placed${dryRunNote}`
      : `❌ GTT exit failed: ${gttResult.error.message}`,
  ].join("\n");

  const alertResult = await pushAlert(alertMessage);
  if (!alertResult.ok) {
    logger.error("Failed to push SL breach alert", {
      symbol: holding.trading_symbol,
      error: alertResult.error.message,
    });
  }
}

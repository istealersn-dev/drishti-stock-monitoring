import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders } from "../../db/schema.js";
import { wasRecentlyAlerted } from "../../shared/dedup.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { TRADING_DAY_MS } from "../../shared/timeWindows.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { buildSlExitRequest } from "../gtt/gtt.service.js";
import { createGTT } from "../gtt/gtt.tools.js";

import type { SlBreach } from "./stopLoss.detector.js";

const SL_EXIT_CREATED_ACTION = "sl_exit_gtt_created"; // logged only on a successful GTT create — for audit/digest counts, not dedup
const SL_EXIT_FAILED_ACTION = "sl_exit_gtt_failed"; // logged on create failure — never gates dedup, so creation keeps retrying
const SL_EXIT_ALERTED_ACTION = "sl_exit_alerted"; // logged only once pushAlert confirms delivery — gates re-sending the alert

/**
 * Returns true if the given symbol already has an active `sl_exit` GTT order
 * recorded locally. Unlike the time-windowed alert dedup, this is a live-state
 * check — a breach spanning multiple trading sessions (e.g. a stock stuck at
 * a circuit limit for days) must never get a second exit GTT stacked on top
 * of the first just because a time window elapsed.
 *
 * Known limitation: nothing in this codebase reconciles `gtt_orders.status`
 * against Upstox when a GTT actually triggers on the exchange (status only
 * ever flips away from "active" via explicit LLM-driven cancel/modify in
 * agent.graph.ts). If an sl_exit GTT triggers and the position is later
 * re-bought, this row stays stale-"active" forever and would silently block
 * a new exit GTT from being created on a fresh breach. Accepted for now —
 * fixing it needs an Upstox GTT-status reconciliation job, which is a
 * separate feature, not part of this dedup fix.
 * @param symbol - The trading symbol to check
 * @returns true if an active sl_exit row exists for this symbol
 */
function hasActiveSlExitGtt(symbol: string): boolean {
  const row = db
    .select({ id: gttOrders.id })
    .from(gttOrders)
    .where(
      and(
        eq(gttOrders.symbol, symbol),
        eq(gttOrders.type, "sl_exit"),
        eq(gttOrders.status, "active"),
      ),
    )
    .get();
  return row !== undefined;
}

/**
 * Handle a single stop-loss breach: create a GTT exit order, alert Slack, and log to DB.
 * GTT creation and alert delivery are deduped independently:
 * - GTT creation is gated on live `gtt_orders` state (an active sl_exit row for this
 *   symbol), not a time window — a breach persisting across many poll ticks, or even
 *   many trading sessions, only ever gets one exit GTT. A failed create is never
 *   deduped, so it keeps retrying every tick until it succeeds.
 * - Alert delivery is gated on a trading-day window, keyed only once pushAlert confirms
 *   delivery — so a transient Slack outage on one tick doesn't permanently swallow the
 *   notification (it retries next tick without re-creating the GTT), and a breach that's
 *   already been alerted about isn't re-announced every 5 minutes.
 * When DRISHTI_DRY_RUN=true, the GTT API call is skipped but all logs and DB rows are written.
 * @param breach - The detected SL breach
 * @param runId - Current agent run ID for log correlation
 */
export async function handleSlBreach(breach: SlBreach, runId: string): Promise<void> {
  const { holding, lastTradedPrice, slThreshold } = breach;
  const symbol = holding.trading_symbol;
  const now = new Date().toISOString();

  const gttAlreadyActive = hasActiveSlExitGtt(symbol);
  const alertAlreadySent = wasRecentlyAlerted(SL_EXIT_ALERTED_ACTION, symbol, TRADING_DAY_MS);

  if (gttAlreadyActive && alertAlreadySent) {
    logger.debug("handleSlBreach: suppressing duplicate — already handled this session", {
      symbol,
    });
    return;
  }

  let gttResult: { ok: true; value: string } | { ok: false; error: { message: string } };

  if (gttAlreadyActive) {
    gttResult = { ok: true, value: "GTT already active from an earlier tick" };
  } else {
    const request = buildSlExitRequest(holding, slThreshold);
    gttResult = await createGTT(request);

    db.insert(gttOrders)
      .values({
        id: crypto.randomUUID(),
        symbol,
        type: "sl_exit",
        triggerPrice: slThreshold,
        limitPrice: request.limit_price,
        quantity: holding.quantity,
        status: gttResult.ok ? "active" : "failed",
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
        symbol,
        action: gttResult.ok ? SL_EXIT_CREATED_ACTION : SL_EXIT_FAILED_ACTION,
        reasoning,
        dryRun: env.DRISHTI_DRY_RUN,
        error: gttResult.ok ? null : gttResult.error.message,
        createdAt: now,
      })
      .run();

    logger.info("SL breach handled", {
      symbol,
      lastTradedPrice,
      slThreshold,
      dryRun: env.DRISHTI_DRY_RUN,
      gttOk: gttResult.ok,
    });
  }

  const dryRunNote = env.DRISHTI_DRY_RUN ? " ⚠️ *DRY RUN — no GTT placed*" : "";
  const alertMessage = [
    `🚨 *SL BREACH — ${symbol}*`,
    `LTP: ₹${lastTradedPrice}  |  SL: ₹${slThreshold}  |  Qty: ${holding.quantity}`,
    gttResult.ok
      ? `✅ GTT exit placed${dryRunNote}`
      : `❌ GTT exit failed: ${gttResult.error.message}`,
  ].join("\n");

  const alertResult = await pushAlert(alertMessage);
  if (!alertResult.ok) {
    logger.error("Failed to push SL breach alert", {
      symbol,
      error: alertResult.error.message,
    });
    return;
  }

  if (gttResult.ok) {
    db.insert(agentLogs)
      .values({
        runId,
        symbol,
        action: SL_EXIT_ALERTED_ACTION,
        reasoning: alertMessage,
        dryRun: env.DRISHTI_DRY_RUN,
        error: null,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

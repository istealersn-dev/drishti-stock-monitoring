import { and, eq, gte, sql } from "drizzle-orm";
import cron from "node-cron";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders, pendingApprovals } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { getCachedHoldings } from "../portfolio/portfolio.cache.js";

import { buildClosingDigest, buildMorningDigest } from "./digest.builder.js";

const DIGEST_CRON_TIMEZONE = "Asia/Kolkata";

function getTodayIsoPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

function queryActiveGttCount(): number {
  const rows = db
    .select({ count: sql<number>`count(*)` })
    .from(gttOrders)
    .where(eq(gttOrders.status, "active"))
    .all();
  return rows[0]?.count ?? 0;
}

function queryPendingApprovalCount(): number {
  const rows = db
    .select({ count: sql<number>`count(*)` })
    .from(pendingApprovals)
    .where(eq(pendingApprovals.status, "pending"))
    .all();
  return rows[0]?.count ?? 0;
}

function queryTodayActionCount(action: string): number {
  const rows = db
    .select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(and(eq(agentLogs.action, action), gte(agentLogs.createdAt, getTodayIsoPrefix())))
    .all();
  return rows[0]?.count ?? 0;
}

const DECISION_ACTIONS = ["hold", "gtt_modify", "gtt_cancel", "alert_only"] as const;

function queryTodayDecisionCount(): number {
  const today = getTodayIsoPrefix();
  const rows = db
    .select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(
      and(
        sql`${agentLogs.action} IN (${DECISION_ACTIONS.join(",")})`,
        gte(agentLogs.createdAt, today),
      ),
    )
    .all();
  return rows[0]?.count ?? 0;
}

/**
 * Send the morning digest to Slack.
 * Reads cached holdings and queries current DB state.
 */
export async function sendMorningDigest(): Promise<void> {
  const { holdings } = getCachedHoldings();
  const message = buildMorningDigest({
    holdings,
    activeGttCount: queryActiveGttCount(),
    pendingApprovalCount: queryPendingApprovalCount(),
    todayBreachCount: 0,
    todayTargetHitCount: 0,
    todayDecisionCount: 0,
    type: "morning",
  });

  const result = await pushAlert(message);
  if (!result.ok) {
    logger.error("Failed to send morning digest", { error: result.error.message });
  } else {
    logger.info("Morning digest sent", { ts: result.value });
  }
}

/**
 * Send the closing digest to Slack.
 * Includes today's breach, target, and decision counts.
 */
export async function sendClosingDigest(): Promise<void> {
  const { holdings } = getCachedHoldings();
  const message = buildClosingDigest({
    holdings,
    activeGttCount: queryActiveGttCount(),
    pendingApprovalCount: queryPendingApprovalCount(),
    todayBreachCount: queryTodayActionCount("sl_exit_gtt_created"),
    todayTargetHitCount:
      queryTodayActionCount("target_t1_hit") + queryTodayActionCount("target_t2_hit"),
    todayDecisionCount: queryTodayDecisionCount(),
    type: "closing",
  });

  const result = await pushAlert(message);
  if (!result.ok) {
    logger.error("Failed to send closing digest", { error: result.error.message });
  } else {
    logger.info("Closing digest sent", { ts: result.value });
  }
}

/**
 * Register digest cron jobs: morning at 09:15 IST and closing at 15:30 IST.
 */
export function startDigestCrons(): void {
  cron.schedule(
    "15 9 * * 1-5",
    () => {
      sendMorningDigest().catch((error: unknown) => {
        logger.error("Morning digest cron failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { timezone: DIGEST_CRON_TIMEZONE },
  );

  cron.schedule(
    "30 15 * * 1-5",
    () => {
      sendClosingDigest().catch((error: unknown) => {
        logger.error("Closing digest cron failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { timezone: DIGEST_CRON_TIMEZONE },
  );

  logger.info("Digest crons registered", { timezone: DIGEST_CRON_TIMEZONE });
}

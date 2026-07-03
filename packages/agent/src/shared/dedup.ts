import { and, eq, gte } from "drizzle-orm";

import { db } from "../db/db.js";
import { agentLogs } from "../db/schema.js";

export const TRADING_DAY_MS = 8 * 60 * 60 * 1000; // 8 h window — covers one full market session

/**
 * Returns true if an agent_log row with the given action+symbol already exists
 * within the cooldown window. Read-only — callers are responsible for writing the
 * dedup row (with the same action+symbol) only after confirming alert delivery.
 * @param action - The agent_logs action string to check
 * @param symbol - The trading symbol, or a sentinel for portfolio-level events
 * @param windowMs - Cooldown duration in milliseconds
 * @returns true if a matching log row exists within the window
 */
export function wasRecentlyAlerted(action: string, symbol: string, windowMs: number): boolean {
  const since = new Date(Date.now() - windowMs).toISOString();
  const row = db
    .select({ id: agentLogs.id })
    .from(agentLogs)
    .where(
      and(
        eq(agentLogs.action, action),
        eq(agentLogs.symbol, symbol),
        gte(agentLogs.createdAt, since),
      ),
    )
    .get();
  return row !== undefined;
}

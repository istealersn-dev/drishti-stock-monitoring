import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentSettings } from "../../db/schema.js";
import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

const SNAPSHOT_SETTINGS_KEY = "llm_analysis_last_ltp";

// In-memory read-through cache over the agentSettings row, so this doesn't add a
// DB query on every tick. null means "not yet loaded from DB this process" —
// distinct from an empty object, which means "loaded, and genuinely no prior data".
let cachedSnapshot: Record<string, number> | null = null;

function loadSnapshot(): Record<string, number> {
  if (cachedSnapshot) return cachedSnapshot;

  const row = db
    .select({ value: agentSettings.value })
    .from(agentSettings)
    .where(eq(agentSettings.key, SNAPSHOT_SETTINGS_KEY))
    .get();

  try {
    cachedSnapshot = row?.value ? (JSON.parse(row.value) as Record<string, number>) : {};
  } catch {
    cachedSnapshot = {};
  }
  return cachedSnapshot;
}

/**
 * Record the LTP of every holding at the moment an LLM analysis actually ran.
 * Persisted to SQLite (agent_settings) so the gate survives process restarts —
 * an in-memory-only snapshot would reset to empty on every restart and force a
 * full-portfolio re-analysis on the next tick, defeating the quota-control gate.
 * @param holdings - Holdings included in the analysis
 * @param ltpMap - Map of instrument_token → LTP used for that analysis
 */
export function recordAnalysisSnapshot(holdings: Holding[], ltpMap: Record<string, LtpData>): void {
  const snapshot: Record<string, number> = {};
  for (const holding of holdings) {
    const ltp = ltpMap[holding.instrument_token]?.last_price ?? holding.last_price;
    snapshot[holding.trading_symbol] = ltp;
  }
  cachedSnapshot = snapshot;

  const now = new Date().toISOString();
  db.insert(agentSettings)
    .values({ key: SNAPSHOT_SETTINGS_KEY, value: JSON.stringify(snapshot), updatedAt: now })
    .onConflictDoUpdate({
      target: agentSettings.key,
      set: { value: JSON.stringify(snapshot), updatedAt: now },
    })
    .run();
}

/**
 * Check whether any holding has moved beyond the threshold since the last
 * recorded analysis snapshot. A holding with no prior snapshot counts as moved.
 * @param holdings - Current holdings
 * @param ltpMap - Map of instrument_token → LTP
 * @param thresholdPct - Minimum absolute % move required to count as significant
 * @returns true if at least one holding has moved beyond the threshold
 */
export function hasMovedSignificantly(
  holdings: Holding[],
  ltpMap: Record<string, LtpData>,
  thresholdPct: number,
): boolean {
  const snapshot = loadSnapshot();
  return holdings.some((holding) => {
    const priorLtp = snapshot[holding.trading_symbol];
    if (priorLtp === undefined) return true;

    const ltp = ltpMap[holding.instrument_token]?.last_price ?? holding.last_price;
    if (priorLtp === 0) return ltp !== 0;

    const movePct = (Math.abs(ltp - priorLtp) / priorLtp) * 100;
    return movePct >= thresholdPct;
  });
}

/** Test-only: clear the cached snapshot so tests don't leak state across cases. */
export function __resetAnalysisSnapshotForTests(): void {
  cachedSnapshot = null;
}

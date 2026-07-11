import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Holding, Quote } from "../../broker/brokerClient.types.js";
import { db } from "../../db/db.js";
import { agentSettings } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";

const SNAPSHOT_SETTINGS_KEY = "llm_analysis_last_ltp";

// .finite() rejects Infinity/-Infinity too — a plain z.number() lets a numeric
// overflow (e.g. `1e1000` parsed by JSON.parse to Infinity) through, which would
// otherwise silently produce NaN in hasMovedSignificantly's move% comparison and
// fail open (never re-triggers analysis for that symbol) instead of resetting.
const AnalysisSnapshotSchema = z.record(z.string(), z.number().finite());

// In-memory read-through cache over the agentSettings row, so this doesn't add a
// DB query on every tick. null means "not yet loaded from DB this process" —
// distinct from an empty object, which means "loaded, and genuinely no prior data".
let cachedSnapshot: Record<string, number> | null = null;

function resetSnapshot(reason: string, detail: string): Record<string, number> {
  logger.error(`insights.cache: ${reason} — resetting llm_analysis_last_ltp`, { error: detail });
  cachedSnapshot = {};
  return cachedSnapshot;
}

function loadSnapshot(): Record<string, number> {
  if (cachedSnapshot) return cachedSnapshot;

  const row = db
    .select({ value: agentSettings.value })
    .from(agentSettings)
    .where(eq(agentSettings.key, SNAPSHOT_SETTINGS_KEY))
    .get();

  if (!row?.value) {
    cachedSnapshot = {};
    return cachedSnapshot;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch (error) {
    return resetSnapshot(
      "llm_analysis_last_ltp is not valid JSON",
      error instanceof Error ? error.message : String(error),
    );
  }

  const result = AnalysisSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    return resetSnapshot("llm_analysis_last_ltp failed schema validation", result.error.message);
  }

  cachedSnapshot = result.data;
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
export function recordAnalysisSnapshot(holdings: Holding[], ltpMap: Record<string, Quote>): void {
  const snapshot: Record<string, number> = {};
  for (const holding of holdings) {
    const ltp = ltpMap[holding.instrumentToken]?.lastPrice ?? holding.lastPrice;
    snapshot[holding.tradingSymbol] = ltp;
  }
  cachedSnapshot = snapshot;

  const now = new Date().toISOString();
  const value = JSON.stringify(snapshot);
  db.insert(agentSettings)
    .values({ key: SNAPSHOT_SETTINGS_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: agentSettings.key,
      set: { value, updatedAt: now },
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
  ltpMap: Record<string, Quote>,
  thresholdPct: number,
): boolean {
  const snapshot = loadSnapshot();
  return holdings.some((holding) => {
    const priorLtp = snapshot[holding.tradingSymbol];
    if (priorLtp === undefined) return true;

    const ltp = ltpMap[holding.instrumentToken]?.lastPrice ?? holding.lastPrice;
    if (priorLtp === 0) return ltp !== 0;

    const movePct = (Math.abs(ltp - priorLtp) / priorLtp) * 100;
    return movePct >= thresholdPct;
  });
}

/** Test-only: clear the cached snapshot so tests don't leak state across cases. */
export function __resetAnalysisSnapshotForTests(): void {
  cachedSnapshot = null;
}

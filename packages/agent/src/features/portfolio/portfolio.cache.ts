import { eq } from "drizzle-orm";
import { z } from "zod";

import { HoldingSchema, type Holding } from "../../broker/brokerClient.types.js";
import { db } from "../../db/db.js";
import { holdingsSnapshot } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";

// The persisted snapshot is a single row; keeping a fixed id makes every write
// an upsert onto the same row rather than an ever-growing history.
const SNAPSHOT_ROW_ID = 1;

const HoldingsArraySchema = z.array(HoldingSchema);

type CacheState = { holdings: Holding[]; cachedAt: string | null };

// In-memory fast path. Starts empty and is hydrated from the DB on first read
// after a restart, so a fresh process still serves last-known-good holdings
// even before the first successful fetch.
let memory: CacheState = { holdings: [], cachedAt: null };
let hydrated = false;

/**
 * Load the persisted snapshot into memory once. Silently starts empty if no
 * snapshot exists yet or the stored JSON fails validation — a bad/absent
 * snapshot must never crash a read.
 */
function hydrateFromDatabase(): void {
  hydrated = true;
  const row = db
    .select()
    .from(holdingsSnapshot)
    .where(eq(holdingsSnapshot.id, SNAPSHOT_ROW_ID))
    .get();
  if (!row) return;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(row.holdingsJson);
  } catch (error) {
    logger.warn("Holdings snapshot JSON is unparseable — ignoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const result = HoldingsArraySchema.safeParse(parsedJson);
  if (!result.success) {
    logger.warn("Holdings snapshot failed schema validation — ignoring", {
      error: result.error.message,
    });
    return;
  }

  memory = { holdings: result.data, cachedAt: row.cachedAt };
  logger.info("Holdings snapshot restored from DB", {
    count: result.data.length,
    cachedAt: row.cachedAt,
  });
}

/**
 * Update the holdings cache in memory and persist a snapshot to the DB. Called
 * by the agent graph after each successful fetch. A DB write failure is logged
 * but does not throw — the in-memory cache is still updated so the current
 * process keeps serving fresh data.
 * @param holdings - Latest holdings from the active broker
 */
export function updateHoldingsCache(holdings: Holding[]): void {
  hydrated = true;
  const cachedAt = new Date().toISOString();
  memory = { holdings, cachedAt };

  try {
    const holdingsJson = JSON.stringify(holdings);
    db.insert(holdingsSnapshot)
      .values({ id: SNAPSHOT_ROW_ID, holdingsJson, cachedAt })
      .onConflictDoUpdate({
        target: holdingsSnapshot.id,
        set: { holdingsJson, cachedAt },
      })
      .run();
  } catch (error) {
    logger.warn("Failed to persist holdings snapshot", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Read the cached holdings without hitting the broker. Hydrates from the
 * persisted snapshot on first call after a restart.
 * @returns Cached holdings and the ISO timestamp of the last update, or null if never populated
 */
export function getCachedHoldings(): CacheState {
  if (!hydrated) hydrateFromDatabase();
  return { holdings: memory.holdings, cachedAt: memory.cachedAt };
}

/**
 * Reset the in-memory cache and force re-hydration on next read. Test-only —
 * the module-level cache would otherwise leak state across test cases.
 */
export function __resetHoldingsCacheForTests(): void {
  memory = { holdings: [], cachedAt: null };
  hydrated = false;
}

import { desc, eq } from "drizzle-orm";

import { getActiveBrokerClient } from "../../broker/brokerClient.registry.js";
import { db } from "../../db/db.js";
import { technicalLevels } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";

import { TechnicalLevelsSchema } from "./technicals.schema.js";
import type { TechnicalLevels } from "./technicals.schema.js";
import { computeLevels } from "./technicals.service.js";

const STALE_AFTER_HOURS = 26;
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const REFRESH_HISTORY_DAYS = 260;

/**
 * Read the most recent cached technical levels for a symbol.
 * @param symbol - The trading symbol to look up
 * @returns The parsed levels, or null when no row exists, the row is stale (>26h old), or parsing fails
 */
export function getCachedLevels(symbol: string): TechnicalLevels | null {
  const row = db
    .select()
    .from(technicalLevels)
    .where(eq(technicalLevels.symbol, symbol))
    .orderBy(desc(technicalLevels.date))
    .all()
    .at(0);

  if (!row) return null;

  const parsed = TechnicalLevelsSchema.safeParse(row);
  if (!parsed.success) return null;

  const ageMillis = Date.now() - new Date(parsed.data.updatedAt).getTime();
  if (ageMillis > STALE_AFTER_HOURS * MILLIS_PER_HOUR) return null;

  return parsed.data;
}

/**
 * Upsert technical levels into the cache, keyed by (symbol, date).
 * @param levels - The technical levels to persist
 * @returns Nothing
 */
export function saveLevels(levels: TechnicalLevels): void {
  db.insert(technicalLevels)
    .values(levels)
    .onConflictDoUpdate({
      target: [technicalLevels.symbol, technicalLevels.date],
      set: {
        dma50: levels.dma50,
        dma200: levels.dma200,
        weekHigh52: levels.weekHigh52,
        weekLow52: levels.weekLow52,
        swingHigh: levels.swingHigh,
        swingLow: levels.swingLow,
        avgVolume20: levels.avgVolume20,
        updatedAt: levels.updatedAt,
      },
    })
    .run();
}

/**
 * Refresh and cache technical levels for a set of symbols.
 * Errors for a single symbol are logged and skipped so remaining symbols still refresh.
 * @param symbols - The trading symbols to refresh
 * @param instrumentKeyMap - Map of trading symbol to Upstox instrument key
 * @returns Nothing
 */
export async function refreshLevels(
  symbols: string[],
  instrumentKeyMap: Record<string, string>,
): Promise<void> {
  for (const symbol of symbols) {
    const instrumentKey = instrumentKeyMap[symbol];
    if (!instrumentKey) {
      logger.warn("Skipping technicals refresh: no instrument key", { symbol });
      continue;
    }

    const result = await getActiveBrokerClient().fetchOHLCV(instrumentKey, REFRESH_HISTORY_DAYS);
    if (!result.ok) {
      logger.error("Failed to refresh technicals", { symbol, error: result.error.message });
      continue;
    }

    saveLevels(computeLevels(symbol, result.value));
  }
}

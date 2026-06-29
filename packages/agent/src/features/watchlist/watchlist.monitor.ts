import { logger } from "../../shared/logger.js";
import { fetchLTP } from "../portfolio/portfolio.tools.js";

import type { ProximityAlert, WatchlistEntry } from "./watchlist.schema.js";

const PROXIMITY_THRESHOLD_PCT = 2.0;

/**
 * Find watchlist symbols trading within 2% of their 200-day moving average.
 * @param entries - Watchlist entries to evaluate
 * @param levelsBySymbol - Technical levels keyed by symbol; only `dma200` is read
 * @param instrumentKeyMap - Upstox instrument key for each symbol (e.g. NSE_EQ|INE002A01018)
 * @returns Proximity alerts for symbols within the threshold (empty when none qualify)
 */
export async function checkProximity(
  entries: WatchlistEntry[],
  levelsBySymbol: Record<string, { dma200: number | null }>,
  instrumentKeyMap: Record<string, string> = {},
): Promise<ProximityAlert[]> {
  const candidates = entries.filter((entry) => {
    const dma200 = levelsBySymbol[entry.symbol]?.dma200;
    return dma200 != null && instrumentKeyMap[entry.symbol] != null;
  });

  if (candidates.length === 0) {
    return [];
  }

  const instrumentKeys = candidates
    .map((entry) => instrumentKeyMap[entry.symbol])
    .filter(Boolean)
    .join(",");
  const ltpResult = await fetchLTP(instrumentKeys);
  if (!ltpResult.ok) {
    logger.error("Watchlist proximity check failed — LTP fetch error", {
      error: ltpResult.error.message,
    });
    return [];
  }
  const ltpMap = ltpResult.value;

  const alerts: ProximityAlert[] = [];
  for (const entry of candidates) {
    const dma200 = levelsBySymbol[entry.symbol]?.dma200;
    if (dma200 == null || dma200 === 0) {
      continue;
    }
    const key = instrumentKeyMap[entry.symbol];
    const ltpData = key ? ltpMap[key] : undefined;
    if (ltpData == null) {
      logger.warn("Watchlist proximity check: no LTP returned for symbol", {
        symbol: entry.symbol,
      });
      continue;
    }
    const ltp = ltpData.last_price;
    const distancePct = (Math.abs(ltp - dma200) / dma200) * 100;
    if (distancePct < PROXIMITY_THRESHOLD_PCT) {
      alerts.push({
        symbol: entry.symbol,
        displayName: entry.displayName,
        ltp,
        dma200,
        distancePct: Number(distancePct.toFixed(2)),
      });
    }
  }

  return alerts;
}

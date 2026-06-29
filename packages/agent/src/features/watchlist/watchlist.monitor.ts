import { fetchLTP } from "../portfolio/portfolio.tools.js";

import type { ProximityAlert, WatchlistEntry } from "./watchlist.schema.js";

const PROXIMITY_THRESHOLD_PCT = 2.0;

/**
 * Build the best-effort instrument key for a watchlist symbol.
 * Watchlist rows store only a symbol, not an Upstox instrument token, so the
 * `NSE_EQ|{symbol}` form is used until real tokens are wired in.
 * @param symbol - The watchlist symbol
 * @returns The instrument key string
 */
function instrumentKeyFor(symbol: string): string {
  return `NSE_EQ|${symbol}`;
}

/**
 * Find watchlist symbols trading within 2% of their 200-day moving average.
 * @param entries - Watchlist entries to evaluate
 * @param levelsBySymbol - Technical levels keyed by symbol; only `dma200` is read
 * @returns Proximity alerts for symbols within the threshold (empty when none qualify)
 */
export async function checkProximity(
  entries: WatchlistEntry[],
  levelsBySymbol: Record<string, { dma200: number | null }>,
): Promise<ProximityAlert[]> {
  const candidates = entries.filter((entry) => {
    const dma200 = levelsBySymbol[entry.symbol]?.dma200;
    return dma200 != null;
  });

  if (candidates.length === 0) {
    return [];
  }

  const instrumentKeys = candidates.map((entry) => instrumentKeyFor(entry.symbol)).join(",");
  const ltpResult = await fetchLTP(instrumentKeys);
  if (!ltpResult.ok) {
    console.warn(
      `Watchlist proximity check skipped — LTP fetch failed: ${ltpResult.error.message}`,
    );
    return [];
  }
  const ltpMap = ltpResult.value;

  const alerts: ProximityAlert[] = [];
  for (const entry of candidates) {
    const dma200 = levelsBySymbol[entry.symbol]?.dma200;
    if (dma200 == null || dma200 === 0) {
      continue;
    }
    const ltpData = ltpMap[instrumentKeyFor(entry.symbol)];
    if (ltpData == null) {
      console.warn(`Watchlist proximity check skipped ${entry.symbol} — no LTP in response`);
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

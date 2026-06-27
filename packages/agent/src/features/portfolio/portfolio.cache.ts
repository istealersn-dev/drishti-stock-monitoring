import type { Holding } from "./portfolio.schema.js";

let cachedHoldings: Holding[] = [];
let cachedAt: string | null = null;

/**
 * Update the in-memory holdings cache. Called by the agent graph after each successful fetch.
 * @param holdings - Latest holdings from Upstox
 */
export function updateHoldingsCache(holdings: Holding[]): void {
  cachedHoldings = holdings;
  cachedAt = new Date().toISOString();
}

/**
 * Read the cached holdings without hitting Upstox.
 * @returns Cached holdings and the ISO timestamp of the last update, or null if never populated
 */
export function getCachedHoldings(): { holdings: Holding[]; cachedAt: string | null } {
  return { holdings: cachedHoldings, cachedAt };
}

import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

let lastAnalysedLtp: Record<string, number> = {};

/**
 * Record the LTP of every holding at the moment an LLM analysis actually ran.
 * Used to gate future calls on materially-changed prices.
 * @param holdings - Holdings included in the analysis
 * @param ltpMap - Map of instrument_token → LTP used for that analysis
 */
export function recordAnalysisSnapshot(holdings: Holding[], ltpMap: Record<string, LtpData>): void {
  const snapshot: Record<string, number> = {};
  for (const holding of holdings) {
    const ltp = ltpMap[holding.instrument_token]?.last_price ?? holding.last_price;
    snapshot[holding.trading_symbol] = ltp;
  }
  lastAnalysedLtp = snapshot;
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
  return holdings.some((holding) => {
    const priorLtp = lastAnalysedLtp[holding.trading_symbol];
    if (priorLtp === undefined) return true;

    const ltp = ltpMap[holding.instrument_token]?.last_price ?? holding.last_price;
    if (priorLtp === 0) return ltp !== 0;

    const movePct = (Math.abs(ltp - priorLtp) / priorLtp) * 100;
    return movePct >= thresholdPct;
  });
}

/** Test-only: clear the in-memory snapshot so tests don't leak state across cases. */
export function __resetAnalysisSnapshotForTests(): void {
  lastAnalysedLtp = {};
}

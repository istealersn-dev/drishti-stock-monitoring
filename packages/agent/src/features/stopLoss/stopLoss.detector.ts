import type { Holding, Quote } from "../../broker/brokerClient.types.js";

import type { StockSlConfig } from "./stopLoss.config.js";

export type SlBreach = {
  holding: Holding;
  lastTradedPrice: number;
  slThreshold: number;
};

/**
 * Detect stop-loss breaches by comparing live LTP against per-stock thresholds.
 * A breach occurs when LTP <= slThreshold.
 * @param holdings - Current portfolio holdings
 * @param ltpMap - Map of instrument key → quote data
 * @param slConfigs - Per-stock SL thresholds from the database
 * @returns Array of breaches detected
 */
export function detectBreaches(
  holdings: Holding[],
  ltpMap: Record<string, Quote>,
  slConfigs: StockSlConfig[],
): SlBreach[] {
  const configBySymbol = new Map(slConfigs.map((config) => [config.symbol, config]));
  const breaches: SlBreach[] = [];

  for (const holding of holdings) {
    const config = configBySymbol.get(holding.tradingSymbol);
    if (!config) continue;

    const ltpEntry = ltpMap[holding.instrumentToken];
    if (!ltpEntry) continue;

    if (ltpEntry.lastPrice <= config.slThreshold) {
      breaches.push({
        holding,
        lastTradedPrice: ltpEntry.lastPrice,
        slThreshold: config.slThreshold,
      });
    }
  }

  return breaches;
}

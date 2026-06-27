import type { LtpData } from "../portfolio/portfolio.schema.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

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
 * @param ltpMap - Map of instrument_token → LTP data
 * @param slConfigs - Per-stock SL thresholds from the database
 * @returns Array of breaches detected
 */
export function detectBreaches(
  holdings: Holding[],
  ltpMap: Record<string, LtpData>,
  slConfigs: StockSlConfig[],
): SlBreach[] {
  const configBySymbol = new Map(slConfigs.map((config) => [config.symbol, config]));
  const breaches: SlBreach[] = [];

  for (const holding of holdings) {
    const config = configBySymbol.get(holding.trading_symbol);
    if (!config) continue;

    const ltpEntry = ltpMap[holding.instrument_token];
    if (!ltpEntry) continue;

    if (ltpEntry.last_price <= config.slThreshold) {
      breaches.push({
        holding,
        lastTradedPrice: ltpEntry.last_price,
        slThreshold: config.slThreshold,
      });
    }
  }

  return breaches;
}

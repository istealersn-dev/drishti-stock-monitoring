import { db } from "../../db/db.js";
import { stockConfig } from "../../db/schema.js";
import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";

export type TargetHit = {
  symbol: string;
  companyName: string;
  targetLevel: 1 | 2;
  targetPrice: number;
  currentPrice: number;
};

type StockTargetConfig = {
  symbol: string;
  targetOne: number | null;
  targetTwo: number | null;
};

/**
 * Load T1/T2 target prices for all active stocks from the database.
 * @returns Array of active stock target configurations
 */
export function loadTargetConfigs(): StockTargetConfig[] {
  return db
    .select({
      symbol: stockConfig.symbol,
      targetOne: stockConfig.targetOne,
      targetTwo: stockConfig.targetTwo,
    })
    .from(stockConfig)
    .all() as StockTargetConfig[];
}

/**
 * Detect T1/T2 target hits for a set of holdings given current LTP prices.
 * T1/T2 hits are alert-only — no auto-action is taken.
 * @param holdings - Current portfolio holdings
 * @param ltpMap - Map of instrument_token → current LTP
 * @param configs - Target configurations from stockConfig table
 * @returns Array of target hits (may be empty)
 */
export function detectTargetHits(
  holdings: Holding[],
  ltpMap: Record<string, LtpData>,
  configs: StockTargetConfig[],
): TargetHit[] {
  const configBySymbol = new Map(configs.map((c) => [c.symbol, c]));
  const hits: TargetHit[] = [];

  for (const holding of holdings) {
    const config = configBySymbol.get(holding.trading_symbol);
    if (!config) continue;

    const ltpEntry = ltpMap[holding.instrument_token];
    const ltp = ltpEntry?.last_price;
    if (ltp === undefined) continue;

    if (config.targetOne !== null && ltp >= config.targetOne) {
      hits.push({
        symbol: holding.trading_symbol,
        companyName: holding.company_name,
        targetLevel: 1,
        targetPrice: config.targetOne,
        currentPrice: ltp,
      });
    }

    if (config.targetTwo !== null && ltp >= config.targetTwo) {
      hits.push({
        symbol: holding.trading_symbol,
        companyName: holding.company_name,
        targetLevel: 2,
        targetPrice: config.targetTwo,
        currentPrice: ltp,
      });
    }
  }

  return hits;
}

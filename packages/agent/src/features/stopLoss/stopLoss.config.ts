import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { stockConfig } from "../../db/schema.js";

export type StockSlConfig = {
  symbol: string;
  slThreshold: number;
};

/**
 * Load all active per-stock stop-loss thresholds from the database.
 * @returns Array of active stock SL configurations
 */
export function loadSlConfigs(): StockSlConfig[] {
  return db
    .select({
      symbol: stockConfig.symbol,
      slThreshold: stockConfig.slThreshold,
    })
    .from(stockConfig)
    .where(eq(stockConfig.isActive, true))
    .all();
}

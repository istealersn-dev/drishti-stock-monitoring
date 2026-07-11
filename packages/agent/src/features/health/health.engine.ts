import { getActiveBrokerClient } from "../../broker/brokerClient.registry.js";
import type { Holding } from "../../broker/brokerClient.types.js";
import { db } from "../../db/db.js";
import { stockConfig } from "../../db/schema.js";
import { chat } from "../../llm/llmClient.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

import type { PortfolioHealthReport, Underperformer } from "./health.schema.js";

const MTF_ANNUAL_RATE = 0.18;
const MONTHS_IN_YEAR = 12;
const MTF_PRODUCT = "MTF";
const UNDERPERFORMER_THRESHOLD = 0.95;

const HEALTH_SYSTEM_PROMPT =
  "You are a portfolio risk manager. Given a portfolio health snapshot, write a 2–3 sentence assessment. Be direct, name specific risks. Plain text only.";

type StockConfigRow = {
  symbol: string;
  slThreshold: number | null;
  isActive: boolean | null;
};

/**
 * Compute capital at risk for a single position: the absolute distance from the current price
 * to the SL threshold, multiplied by quantity. For positions above SL this is potential future
 * loss; for positions below SL (breach) this is the additional downside if not yet exited.
 * Both cases represent real open exposure that the operator must act on.
 * @param holding - The portfolio holding
 * @param slThreshold - The stop-loss threshold price, or null/undefined when unconfigured
 * @returns Capital at risk in rupees (0 when no SL is configured)
 */
function capitalAtRiskFor(holding: Holding, slThreshold: number | null | undefined): number {
  if (slThreshold == null || slThreshold === 0) {
    return 0;
  }
  return Math.abs(holding.lastPrice - slThreshold) * holding.quantity;
}

/**
 * Compute a full portfolio health report: capital-at-risk, MTF burn rate,
 * underperformers, positions overdue for SL review, and an LLM narrative.
 * @returns A Result with the health report, or an Error on holdings/LLM failure
 */
export async function computeHealthReport(): Promise<Result<PortfolioHealthReport, Error>> {
  const holdingsResult = await getActiveBrokerClient().fetchHoldings();
  if (!holdingsResult.ok) {
    return err(holdingsResult.error);
  }
  const holdings = holdingsResult.value;

  const configRows: StockConfigRow[] = db.select().from(stockConfig).all();
  const slBySymbol = new Map<string, number | null>(
    configRows.map((row) => [row.symbol, row.slThreshold]),
  );

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.quantity * h.lastPrice, 0);

  const totalCapitalAtRisk = holdings.reduce(
    (sum, h) => sum + capitalAtRiskFor(h, slBySymbol.get(h.tradingSymbol)),
    0,
  );

  const capitalAtRiskPct =
    totalPortfolioValue > 0 ? (totalCapitalAtRisk / totalPortfolioValue) * 100 : 0;

  const mtfBurnRateMonthly = holdings
    .filter((h) => h.product === MTF_PRODUCT)
    .reduce((sum, h) => sum + (h.quantity * h.averagePrice * MTF_ANNUAL_RATE) / MONTHS_IN_YEAR, 0);

  const underperformers: Underperformer[] = holdings
    .filter((h) => h.lastPrice < h.averagePrice * UNDERPERFORMER_THRESHOLD)
    .map((h) => ({
      symbol: h.tradingSymbol,
      companyName: h.companyName,
      buyPrice: h.averagePrice,
      currentLtp: h.lastPrice,
      pctDown: Number((((h.averagePrice - h.lastPrice) / h.averagePrice) * 100).toFixed(2)),
    }));

  // Positions with a config row but no SL set
  const configuredWithoutSl = configRows
    .filter((row) => row.isActive === true && (row.slThreshold == null || row.slThreshold === 0))
    .map((row) => row.symbol);
  // Active holdings with no stock_config row at all (never configured)
  const neverConfigured = holdings
    .filter((h) => !slBySymbol.has(h.tradingSymbol))
    .map((h) => h.tradingSymbol);
  const overdueForReview = [...new Set([...configuredWithoutSl, ...neverConfigured])];

  const metrics = {
    generatedAt: new Date().toISOString(),
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    totalCapitalAtRisk: Number(totalCapitalAtRisk.toFixed(2)),
    capitalAtRiskPct: Number(capitalAtRiskPct.toFixed(2)),
    mtfBurnRateMonthly: Number(mtfBurnRateMonthly.toFixed(2)),
    activePositionCount: holdings.length,
    underperformers,
    overdueForReview,
  };

  let llmNarrative: string;
  try {
    llmNarrative = await chat([
      { role: "system", content: HEALTH_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(metrics) },
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn("Health narrative unavailable — returning metrics without LLM commentary", {
      error: message,
    });
    llmNarrative = "Narrative unavailable (LM Studio unreachable).";
  }

  return ok({ ...metrics, llmNarrative });
}

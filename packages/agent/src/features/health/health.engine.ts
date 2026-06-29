import { db } from "../../db/db.js";
import { stockConfig } from "../../db/schema.js";
import { chat } from "../../llm/llmClient.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import type { Holding } from "../portfolio/portfolio.schema.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";

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
 * Compute capital at risk for a single position: the loss if stopped out at the SL price.
 * For positions below SL (already breached), uses full downside from current price to SL.
 * @param holding - The portfolio holding
 * @param slThreshold - The stop-loss threshold price, or null/undefined when unconfigured
 * @returns Capital at risk in rupees (0 when no threshold is known or position is above entry with no stop)
 */
function capitalAtRiskFor(holding: Holding, slThreshold: number | null | undefined): number {
  if (slThreshold == null || slThreshold === 0) {
    return 0;
  }
  // Risk = (current price - SL) * qty; negative when already below SL (breach)
  const riskPerUnit = holding.last_price - slThreshold;
  return Math.abs(riskPerUnit) * holding.quantity;
}

/**
 * Compute a full portfolio health report: capital-at-risk, MTF burn rate,
 * underperformers, positions overdue for SL review, and an LLM narrative.
 * @returns A Result with the health report, or an Error on holdings/LLM failure
 */
export async function computeHealthReport(): Promise<Result<PortfolioHealthReport, Error>> {
  const holdingsResult = await fetchHoldings();
  if (!holdingsResult.ok) {
    return err(holdingsResult.error);
  }
  const holdings = holdingsResult.value;

  const configRows: StockConfigRow[] = db.select().from(stockConfig).all();
  const slBySymbol = new Map<string, number | null>(
    configRows.map((row) => [row.symbol, row.slThreshold]),
  );

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.quantity * h.last_price, 0);

  const totalCapitalAtRisk = holdings.reduce(
    (sum, h) => sum + capitalAtRiskFor(h, slBySymbol.get(h.trading_symbol)),
    0,
  );

  const capitalAtRiskPct =
    totalPortfolioValue > 0 ? (totalCapitalAtRisk / totalPortfolioValue) * 100 : 0;

  const mtfBurnRateMonthly = holdings
    .filter((h) => h.product === MTF_PRODUCT)
    .reduce((sum, h) => sum + (h.quantity * h.average_price * MTF_ANNUAL_RATE) / MONTHS_IN_YEAR, 0);

  const underperformers: Underperformer[] = holdings
    .filter((h) => h.last_price < h.average_price * UNDERPERFORMER_THRESHOLD)
    .map((h) => ({
      symbol: h.trading_symbol,
      companyName: h.company_name,
      buyPrice: h.average_price,
      currentLtp: h.last_price,
      pctDown: Number((((h.average_price - h.last_price) / h.average_price) * 100).toFixed(2)),
    }));

  const overdueForReview = configRows
    .filter((row) => row.isActive === true && (row.slThreshold == null || row.slThreshold === 0))
    .map((row) => row.symbol);

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
    return err(new Error(`Failed to generate health narrative: ${message}`));
  }

  return ok({ ...metrics, llmNarrative });
}

import { fetchHoldings } from "../portfolio/portfolio.tools.js";

import type { ValidationResult } from "./validator.schema.js";

const MAX_SINGLE_POSITION_PCT = 25;

/**
 * Validate that a new position would not exceed the single-position concentration
 * cap (25% of total portfolio value). Does not block when holdings data is
 * unavailable.
 * @param suggestedQty - The suggested quantity for the new position
 * @param entryHigh - The upper bound of the entry range, used to value the position
 * @returns A pass result, or a fail result with a human-readable reason
 */
export async function validateConcentration(
  suggestedQty: number,
  entryHigh: number,
): Promise<ValidationResult> {
  const holdingsResult = await fetchHoldings();
  if (!holdingsResult.ok) {
    return { pass: true };
  }

  const totalPortfolioValue = holdingsResult.value.reduce(
    (sum, holding) => sum + holding.quantity * holding.last_price,
    0,
  );
  if (totalPortfolioValue <= 0) {
    return { pass: true };
  }

  const newPositionValue = suggestedQty * entryHigh;
  const pct = (newPositionValue / (totalPortfolioValue + newPositionValue)) * 100;
  if (pct > MAX_SINGLE_POSITION_PCT) {
    return {
      pass: false,
      reason: `Position (₹${(newPositionValue / 100000).toFixed(1)}L) would be ${pct.toFixed(0)}% of portfolio — exceeds 25% single-position cap.`,
    };
  }

  return { pass: true };
}

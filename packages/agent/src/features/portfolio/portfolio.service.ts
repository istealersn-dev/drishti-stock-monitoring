import type { Holding } from "./portfolio.schema.js";

type PortfolioSummary = {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdingCount: number;
};

/**
 * Compute a high-level summary from a list of holdings.
 * @param holdings - Array of holdings from Upstox
 * @returns Aggregated portfolio summary
 */
export function buildPortfolioSummary(holdings: Holding[]): PortfolioSummary {
  let totalValue = 0;
  let totalCost = 0;

  for (const h of holdings) {
    totalValue += h.last_price * h.quantity;
    totalCost += h.average_price * h.quantity;
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    holdingCount: holdings.length,
  };
}

/**
 * Format a portfolio summary as a human-readable string for Slack.
 * @param summary - The portfolio summary to format
 * @returns Slack-ready text
 */
export function formatPortfolioSummary(summary: PortfolioSummary): string {
  const sign = summary.totalPnl >= 0 ? "+" : "";
  const pnlSign = summary.totalPnlPercent >= 0 ? "+" : "";
  return [
    `*Drishti — Portfolio Snapshot*`,
    `Holdings: ${summary.holdingCount} positions`,
    `Total value: ₹${summary.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
    `Unrealised P&L: ${sign}₹${summary.totalPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${pnlSign}${summary.totalPnlPercent.toFixed(2)}%)`,
  ].join("\n");
}

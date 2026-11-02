import type { BadgeVariant } from "../components/ui/badge";

import type { Holding } from "./api";

/**
 * Formats a price with 2 decimal places, en-IN grouping (no ₹ prefix — callers
 * that need the symbol prepend it themselves).
 * @param price - the price to format
 * @returns formatted price string
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Sums a holdings list's current market value (quantity × last price).
 * Shared by Dashboard's headline stat and the shell footer/header's
 * portfolio-value meta so the two can't silently drift on the formula.
 * @param holdings - the holdings to sum
 * @returns total current market value in rupees
 */
export function sumHoldingsValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.quantity * h.last_price, 0);
}

/**
 * Profit or loss as a percentage of cost, guarding a zero cost.
 * @param pnl - profit or loss in rupees
 * @param cost - the cost basis
 * @returns the percentage, or 0 when there's no cost basis
 */
export function percentOfCost(pnl: number, cost: number): number {
  return cost > 0 ? (pnl / cost) * 100 : 0;
}

/**
 * A holding's unrealised P&L as a percentage of cost, guarding a zero cost.
 * @param holding - the holding
 * @returns P&L percent, or 0 when there's no cost basis
 */
export function pnlPercentage(holding: Holding): number {
  return percentOfCost(holding.pnl, holding.quantity * holding.average_price);
}

/**
 * How far a holding's LTP sits above its stop-loss, as a percentage of the SL.
 * @param holding - the holding
 * @param sl - the stop-loss trigger, if one is set
 * @returns the distance percent, or undefined with no usable stop-loss
 */
export function distanceToSlPercentage(
  holding: Holding,
  sl: number | undefined,
): number | undefined {
  return sl ? ((holding.last_price - sl) / sl) * 100 : undefined;
}

/**
 * Formats an unrealised P&L as a signed rupee amount plus a percent-of-cost
 * suffix, e.g. "+₹32,160 (+114.5%)".
 * @param pnl - unrealised profit/loss in rupees
 * @param cost - the position's cost basis (quantity × average price)
 * @returns formatted P&L string
 */
export function formatPnl(pnl: number, cost: number): string {
  const percentage = percentOfCost(pnl, cost);
  const sign = pnl >= 0 ? "+" : "−";
  const absoluteAmount = Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${sign}₹${absoluteAmount} (${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%)`;
}

/**
 * Maps a holding's product code to a Badge tint — MTF and CNC get distinct
 * semantic tints, anything else falls back to neutral.
 * @param product - the holding's product code (e.g. "MTF", "CNC")
 * @returns a Badge variant name
 */
export function productBadgeVariant(product: string): BadgeVariant {
  if (product === "MTF") return "warn";
  if (product === "CNC") return "info";
  return "neutral";
}

/**
 * Direction glyph for LTP vs close, so movement isn't conveyed by color alone
 * (Design.md §7 "color-never-alone").
 * @param lastPrice - the holding's last traded price
 * @param closePrice - the holding's previous close price
 * @returns "▲" if at or above close, "▼" otherwise
 */
export function ltpDirectionArrow(lastPrice: number, closePrice: number): "▲" | "▼" {
  return lastPrice >= closePrice ? "▲" : "▼";
}

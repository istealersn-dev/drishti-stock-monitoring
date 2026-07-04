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
 * Formats an unrealised P&L as a signed rupee amount plus a percent-of-cost
 * suffix, e.g. "+₹32,160 (+114.5%)".
 * @param pnl - unrealised profit/loss in rupees
 * @param cost - the position's cost basis (quantity × average price)
 * @returns formatted P&L string
 */
export function formatPnl(pnl: number, cost: number): string {
  const percentage = cost > 0 ? (pnl / cost) * 100 : 0;
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
export function productBadgeVariant(product: string): "warn" | "info" | "neutral" {
  if (product === "MTF") return "warn";
  if (product === "CNC") return "info";
  return "neutral";
}

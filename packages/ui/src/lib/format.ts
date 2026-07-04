const ONE_LAKH = 100_000;

/**
 * Formats a rupee amount, abbreviating to lakhs above ₹1L (e.g. "₹4.2L"),
 * otherwise a plain grouped rupee figure (e.g. "₹32,160").
 * @param amount - the rupee amount (sign is ignored — always renders positive)
 * @returns formatted, abbreviated rupee string
 */
export function formatInr(amount: number): string {
  const absoluteAmount = Math.abs(amount);
  if (absoluteAmount >= ONE_LAKH) {
    return `₹${(absoluteAmount / ONE_LAKH).toFixed(1)}L`;
  }
  return `₹${absoluteAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * Formats a nullable price with 2 decimal places, en-IN grouping, falling
 * back to an em-dash for unset values (e.g. an instruction with no upper
 * entry bound).
 * @param price - the price to format, or null if unset
 * @returns formatted price string, or "—" if null
 */
export function formatPriceOrDash(price: number | null): string {
  if (price === null) return "—";
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats an ISO timestamp as a short day/month date, e.g. "04 Jul".
 * @param iso - ISO 8601 timestamp
 * @returns formatted date string
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/**
 * Formats an ISO timestamp as a 24-hour time with seconds, e.g. "14:32:07".
 * @param iso - ISO 8601 timestamp
 * @returns formatted time string
 */
export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

type BadgeVariant = "pos" | "neg" | "warn" | "info" | "neutral";

/**
 * Maps a GTT order's status to a Badge tint — active is positive, triggered
 * is informational, cancelled falls back to neutral, anything else (e.g.
 * failed) is negative.
 * @param status - the GTT order's status string
 * @returns a Badge variant name
 */
export function gttStatusVariant(status: string): BadgeVariant {
  if (status === "active") return "pos";
  if (status === "triggered") return "info";
  if (status === "cancelled") return "neutral";
  return "neg";
}

/**
 * Maps a GTT order's type to a Badge tint — SL orders are risk-related
 * (negative tint), everything else (buy/target) is informational.
 * @param type - the GTT order's type string (e.g. "SL", "BUY")
 * @returns a Badge variant name
 */
export function gttTypeVariant(type: string): BadgeVariant {
  return type.toLowerCase().includes("sl") ? "neg" : "info";
}

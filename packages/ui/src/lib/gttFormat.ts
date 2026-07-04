import type { BadgeVariant } from "../components/ui/badge";

/**
 * Maps a GTT order's status to a Badge tint — active is positive, triggered
 * is informational, cancelled and any unrecognized status fall back to
 * neutral, and only the known "failed" status is negative.
 * @param status - the GTT order's status string
 * @returns a Badge variant name
 */
export function gttStatusVariant(status: string): BadgeVariant {
  if (status === "active") return "pos";
  if (status === "triggered") return "info";
  if (status === "failed") return "neg";
  return "neutral";
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

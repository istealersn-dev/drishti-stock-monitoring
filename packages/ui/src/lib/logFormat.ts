import type { BadgeVariant } from "../components/ui/badge";

export type LogCategory = "SL_EXIT" | "GTT_CREATED" | "ALERT" | "HOLD" | "APPROVAL" | "OTHER";

/**
 * Categorizes an agent log's action string into one of the filterable log
 * categories — the single source of truth for both `LogFilters`' matching
 * and `LogRow`'s action-chip coloring, so the two can't drift on what
 * substrings count as e.g. an SL exit.
 * @param action - the log entry's raw action string
 * @returns the log's category
 */
export function resolveLogCategory(action: string): LogCategory {
  if (action.includes("sl_exit")) return "SL_EXIT";
  if (action.includes("gtt_created") || action.includes("gtt_modified")) return "GTT_CREATED";
  if (action.includes("alert")) return "ALERT";
  if (action.includes("hold")) return "HOLD";
  if (action.includes("approval")) return "APPROVAL";
  return "OTHER";
}

// Matches Drishti.dc.html's actionStyle() exactly for the categories with a
// confirmed real backend action string (gtt_created→amber, approval→green) —
// GTT_CREATED and APPROVAL were previously green/blue, not amber/green.
const CATEGORY_VARIANT: Record<LogCategory, BadgeVariant> = {
  SL_EXIT: "neg",
  GTT_CREATED: "warn",
  ALERT: "warn",
  HOLD: "neutral",
  APPROVAL: "pos",
  OTHER: "neutral",
};

/**
 * Maps an agent log's action string to a Badge tint via its category.
 * @param action - the log entry's raw action string
 * @returns a Badge variant name
 */
export function logActionBadgeVariant(action: string): BadgeVariant {
  return CATEGORY_VARIANT[resolveLogCategory(action)];
}

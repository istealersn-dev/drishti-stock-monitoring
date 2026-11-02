import { z } from "zod";

export const APPROVAL_SOURCES = ["drishti", "you"] as const;
export const HOLDING_FILTERS = ["ALL", "MTF", "CNC", "BREACH", "WATCH"] as const;
export const SETTINGS_TABS = ["brokers", "agent", "runtime", "danger"] as const;

/** Which side of the approvals screen is showing. */
export type ApprovalSource = (typeof APPROVAL_SOURCES)[number];
export type ProductFilter = (typeof HOLDING_FILTERS)[number];
export type SettingsTab = (typeof SETTINGS_TABS)[number];

// `.catch` so a stale or hand-edited URL falls back to the default view.
export const approvalsSearchSchema = z.object({
  tab: z.enum(APPROVAL_SOURCES).optional().catch(undefined),
});
export const holdingsSearchSchema = z.object({
  filter: z.enum(HOLDING_FILTERS).optional().catch(undefined),
});
export const settingsSearchSchema = z.object({
  tab: z.enum(SETTINGS_TABS).optional().catch(undefined),
});

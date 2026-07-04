import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentSettings } from "../../db/schema.js";

export const PAUSE_AGENT_SETTINGS_KEY = "pause_agent";
export const BOOLEAN_SETTING_VALUES = ["true", "false"] as const;

/**
 * Interpret a raw agent_settings string value as a boolean, matching the
 * "true"/"false" string convention used to persist toggle settings.
 * @param value - Raw stored value, or undefined if no row exists
 * @returns true only if value is exactly "true"
 */
export function isBooleanSettingEnabled(value: string | undefined): boolean {
  return value === "true";
}

/**
 * Check whether the agent scheduler is paused via the dashboard "Pause agent" toggle.
 * @returns true if the pause_agent DB setting is "true"; defaults to false (not paused)
 */
export function isAgentPaused(): boolean {
  const row = db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.key, PAUSE_AGENT_SETTINGS_KEY))
    .get();
  return isBooleanSettingEnabled(row?.value);
}

import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentSettings } from "../../db/schema.js";

/**
 * Check whether the agent scheduler is paused via the dashboard "Pause agent" toggle.
 * @returns true if the pause_agent DB setting is "true"; defaults to false (not paused)
 */
export function isAgentPaused(): boolean {
  const row = db.select().from(agentSettings).where(eq(agentSettings.key, "pause_agent")).get();
  return row?.value === "true";
}

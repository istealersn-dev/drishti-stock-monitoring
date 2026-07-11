import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentSettings, brokerConnections } from "../../db/schema.js";
import { BrokerIdSchema } from "../../shared/brokerId.js";
import type { BrokerId } from "../../shared/brokerId.js";

export const PAUSE_AGENT_SETTINGS_KEY = "pause_agent";
export const BOOLEAN_SETTING_VALUES = ["true", "false"] as const;

const ACTIVE_BROKER_ID_KEY = "active_broker_id";
const DEFAULT_BROKER_ID: BrokerId = "upstox";

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

/**
 * Read which broker is currently active. Defaults to "upstox" when no
 * active_broker_id setting has been persisted yet (first boot) or the stored
 * value doesn't match a known BrokerId.
 * @returns The active broker's id
 */
export function getActiveBrokerId(): BrokerId {
  const row = db
    .select()
    .from(agentSettings)
    .where(eq(agentSettings.key, ACTIVE_BROKER_ID_KEY))
    .get();
  const parsed = BrokerIdSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_BROKER_ID;
}

/**
 * Set the active broker: persists the active_broker_id setting and flips the
 * broker_connections table so exactly one row has isActive=true. Both writes
 * happen in one transaction so a crash mid-write can't leave the setting and
 * the connections table disagreeing about which broker is active.
 * @param brokerId - The broker to activate
 * @returns Nothing
 */
export function setActiveBroker(brokerId: BrokerId): void {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(agentSettings)
      .values({ key: ACTIVE_BROKER_ID_KEY, value: brokerId, updatedAt: now })
      .onConflictDoUpdate({
        target: agentSettings.key,
        set: { value: brokerId, updatedAt: now },
      })
      .run();

    tx.update(brokerConnections).set({ isActive: false, updatedAt: now }).run();

    tx.insert(brokerConnections)
      .values({ brokerId, isActive: true, status: "connected", createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: brokerConnections.brokerId,
        set: { isActive: true, updatedAt: now },
      })
      .run();
  });
}

/**
 * List all known broker connection status rows.
 * @returns Every broker_connections row (may be empty before any broker has ever been activated)
 */
export function getBrokerConnections(): (typeof brokerConnections.$inferSelect)[] {
  return db.select().from(brokerConnections).all();
}

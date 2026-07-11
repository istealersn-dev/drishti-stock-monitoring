import type { BrokerClient } from "./brokerClient.types.js";
import { createUpstoxClient } from "./upstox/upstox.client.js";

/**
 * Resolve the BrokerClient for whichever broker is currently active. Hardcoded
 * to Upstox for now — reading the active broker from persisted settings lands
 * in a later PR once broker_connections/agent_settings support it.
 * @returns The active BrokerClient
 */
export function getActiveBrokerClient(): BrokerClient {
  return createUpstoxClient();
}

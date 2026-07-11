import { getActiveBrokerId } from "../features/settings/settings.service.js";
import { logger } from "../shared/logger.js";

import type { BrokerClient } from "./brokerClient.types.js";
import { createUpstoxClient } from "./upstox/upstox.client.js";

/**
 * Resolve the BrokerClient for whichever broker is currently active, per the
 * active_broker_id setting (see settings.service.ts's getActiveBrokerId).
 * Falls back to Upstox for any broker id without an adapter yet (e.g. "groww"
 * before its adapter ships) rather than throwing, since a dangling active_broker_id
 * setting must not take the whole agent down.
 * @returns The active BrokerClient
 */
export function getActiveBrokerClient(): BrokerClient {
  const brokerId = getActiveBrokerId();
  switch (brokerId) {
    case "upstox":
      return createUpstoxClient();
    default:
      logger.warn("getActiveBrokerClient: no adapter for active broker — falling back to Upstox", {
        brokerId,
      });
      return createUpstoxClient();
  }
}

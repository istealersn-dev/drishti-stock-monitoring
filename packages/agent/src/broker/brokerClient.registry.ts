import { getActiveBrokerId } from "../features/settings/settings.service.js";
import type { BrokerId } from "../shared/brokerId.js";
import { logger } from "../shared/logger.js";

import type { BrokerClient } from "./brokerClient.types.js";
import { createUpstoxClient } from "./upstox/upstox.client.js";

/**
 * Broker ids with a real adapter behind them. Any other known BrokerId (e.g.
 * "groww" before its adapter ships) is a valid enum value but has no working
 * integration yet — callers that expose broker status to a user (verify,
 * activate) must check this before claiming success, since createBrokerClient
 * silently falls back to Upstox and would otherwise report an unimplemented
 * broker as "connected".
 */
export const IMPLEMENTED_BROKER_IDS: readonly BrokerId[] = ["upstox"];

/**
 * Build a BrokerClient for a specific broker id, regardless of which broker
 * is currently active. Falls back to Upstox for any broker id without an
 * adapter yet (e.g. "groww" before its adapter ships) rather than throwing,
 * since a dangling active_broker_id setting or a verify request for an
 * unimplemented broker must not take the whole agent down.
 * @param brokerId - The broker to build a client for
 * @returns A BrokerClient for that broker (or the Upstox fallback)
 */
export function createBrokerClient(brokerId: BrokerId): BrokerClient {
  switch (brokerId) {
    case "upstox":
      return createUpstoxClient();
    default:
      logger.warn("createBrokerClient: no adapter for broker — falling back to Upstox", {
        brokerId,
      });
      return createUpstoxClient();
  }
}

/**
 * Resolve the BrokerClient for whichever broker is currently active, per the
 * active_broker_id setting (see settings.service.ts's getActiveBrokerId).
 * @returns The active BrokerClient
 */
export function getActiveBrokerClient(): BrokerClient {
  return createBrokerClient(getActiveBrokerId());
}

import type { BadgeVariant } from "../components/ui/badge";

import { AgentUnreachableError, ApiError } from "./apiError";

const BROKER_UNAUTHORIZED_CODE = "BROKER_UNAUTHORIZED";

/**
 * Why a health check failed, from the UI's point of view:
 * - "unreachable": the agent process didn't respond at all
 * - "broker-auth": the agent is up, but the broker token is expired/invalid
 * - "other": some other agent-side failure (LLM, computation, unexpected 500)
 */
export type HealthErrorKind = "unreachable" | "broker-auth" | "other";

/**
 * Classify a thrown health-query error into an actionable kind, so surfaces
 * can tell "the agent is down" (check the process) apart from "the broker
 * token expired" (reconnect the broker) instead of collapsing both into a
 * generic error.
 * @param error - The error React Query captured from fetchHealth
 * @returns The health error kind
 */
export function classifyHealthError(error: unknown): HealthErrorKind {
  if (error instanceof AgentUnreachableError) return "unreachable";
  if (error instanceof ApiError && error.code === BROKER_UNAUTHORIZED_CODE) return "broker-auth";
  return "other";
}

// The backend only caches successful health reports (/api/health reruns a
// full live Upstox+LLM computation on every request while there's no cached
// success yet) — so during an outage, the app default's 30s refetchInterval
// would retry that live call every 30s for as long as any consumer of the
// ["health"] query stays mounted. Shared by BrokerCard and the Ask composer
// so a second consumer can't reintroduce the same problem by omitting it.
export const HEALTH_CHECK_INTERVAL_MS = 5 * 60_000;

export type HealthStatus = {
  variant: "pos" | "neg" | "warn";
  label: string;
};

export type StatusPill = {
  variant: BadgeVariant;
  label: string;
};

/**
 * Health dot + label reflect whether the agent is actively polling —
 * independent of dry-run. Shared by AppFooter (desktop) and AppHeaderMobile
 * so the two surfaces can't drift on what "Agent paused"/"Error" means.
 * @param paused - whether the agent poll tick is paused
 * @param hasError - whether the agent settings fetch failed (agent unreachable)
 * @returns the health dot's variant and label
 */
export function resolveHealth(paused: boolean, hasError: boolean): HealthStatus {
  // Driven by the settings query, not health — if the shell can't even load
  // settings, the agent process itself is unreachable. Broker-auth failures
  // (agent up, token expired) surface on the Brokers card, not here.
  if (hasError) return { variant: "neg", label: "Agent unreachable" };
  if (paused) return { variant: "warn", label: "Agent paused" };
  return { variant: "pos", label: "Systems operational" };
}

/**
 * Status pill takes priority: Dry Run overrides Paused overrides Running
 * (Drishti.dc.html's `status` object). Shared by AppFooter and
 * AppHeaderMobile so dry-run visibility can't silently regress on either
 * surface.
 * @param dryRun - whether dry-run mode is active
 * @param paused - whether the agent poll tick is paused
 * @returns the status pill's variant and label
 */
export function resolveStatusPill(dryRun: boolean, paused: boolean): StatusPill {
  if (dryRun) return { variant: "warn", label: "Dry Run" };
  if (paused) return { variant: "neutral", label: "Paused" };
  return { variant: "pos", label: "Running" };
}

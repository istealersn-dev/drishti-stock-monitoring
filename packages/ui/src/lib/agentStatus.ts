import type { BadgeVariant } from "../components/ui/badge";

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
 * @param hasError - whether the settings/health fetch failed
 * @returns the health dot's variant and label
 */
export function resolveHealth(paused: boolean, hasError: boolean): HealthStatus {
  if (hasError) return { variant: "neg", label: "Error" };
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

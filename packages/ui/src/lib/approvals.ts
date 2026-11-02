import type { Approval } from "./api";

/**
 * The approvals still waiting on a decision.
 * @param approvals - approvals from the API
 * @returns the pending ones
 */
export function filterPendingApprovals(approvals: Approval[]): Approval[] {
  return approvals.filter((approval) => approval.status === "pending");
}

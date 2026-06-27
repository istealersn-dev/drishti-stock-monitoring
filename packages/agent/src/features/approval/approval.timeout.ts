import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { updateApprovalCard } from "../instructions/instructions.approval.js";

import { findExpiredPending, resolveApproval } from "./approval.store.js";

const POLL_INTERVAL_MS = 60_000;

/**
 * Compute the ISO cutoff timestamp for expired approvals.
 * @returns ISO string for (now - timeout minutes)
 */
function expiryThresholdIso(): string {
  const cutoff = new Date(Date.now() - env.DRISHTI_APPROVAL_TIMEOUT_MINUTES * 60 * 1000);
  return cutoff.toISOString();
}

/**
 * Check for and expire any pending approvals that have passed their timeout.
 * Called on each poll tick.
 */
export async function expireTimedOutApprovals(): Promise<void> {
  const cutoff = expiryThresholdIso();
  const expired = findExpiredPending(cutoff);

  for (const approval of expired) {
    resolveApproval(approval.id, "expired");
    logger.info("Approval expired", {
      approvalId: approval.id,
      symbol: approval.symbol,
      createdAt: approval.createdAt,
    });

    if (approval.slackTs) {
      const updateResult = await updateApprovalCard(approval.slackTs, approval.symbol, "expired");
      if (!updateResult.ok) {
        logger.warn("Failed to update card after expiry", {
          approvalId: approval.id,
          error: updateResult.error.message,
        });
      }
    }
  }
}

/**
 * Start the approval timeout poller.
 * Runs every minute to expire unanswered approvals.
 */
export function startTimeoutPoller(): void {
  setInterval(() => {
    expireTimedOutApprovals().catch((error: unknown) => {
      logger.error("Approval timeout poller error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, POLL_INTERVAL_MS);

  logger.info("Approval timeout poller started", {
    timeoutMinutes: env.DRISHTI_APPROVAL_TIMEOUT_MINUTES,
  });
}

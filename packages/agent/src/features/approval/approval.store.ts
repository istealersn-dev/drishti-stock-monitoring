import { and, eq, lt } from "drizzle-orm";

import { db } from "../../db/db.js";
import { pendingApprovals } from "../../db/schema.js";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalRow = {
  id: string;
  symbol: string;
  parsedJson: string;
  suggestedQty: number;
  overrideQty: number | null;
  status: ApprovalStatus;
  slackTs: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

/**
 * Insert a new pending approval record into the database.
 * @param data - The approval data to insert
 */
export function createApproval(data: {
  id: string;
  symbol: string;
  parsedJson: string;
  suggestedQty: number;
  slackTs?: string;
}): void {
  db.insert(pendingApprovals)
    .values({
      id: data.id,
      symbol: data.symbol,
      parsedJson: data.parsedJson,
      suggestedQty: data.suggestedQty,
      status: "pending",
      slackTs: data.slackTs ?? null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    })
    .run();
}

/**
 * Look up a pending approval by its ID.
 * @param id - The approval UUID
 * @returns The approval row or null if not found
 */
export function getApproval(id: string): ApprovalRow | null {
  const rows = db.select().from(pendingApprovals).where(eq(pendingApprovals.id, id)).all();

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    status: row.status as ApprovalStatus,
  };
}

/**
 * Update an approval's status to approved, rejected, or expired.
 * @param id - The approval UUID
 * @param status - The new status
 */
export function resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">): void {
  db.update(pendingApprovals)
    .set({ status, resolvedAt: new Date().toISOString() })
    .where(eq(pendingApprovals.id, id))
    .run();
}

/**
 * Update the Slack message timestamp on an approval (used when the card is posted after DB insert).
 * @param id - The approval UUID
 * @param slackTs - The Slack message timestamp
 */
export function setApprovalSlackTs(id: string, slackTs: string): void {
  db.update(pendingApprovals).set({ slackTs }).where(eq(pendingApprovals.id, id)).run();
}

/**
 * Record an approver-chosen quantity override, taking priority over suggestedQty
 * at execution time (see executeApprovedInstruction).
 * @param id - The approval UUID
 * @param qty - The overridden quantity
 */
export function setApprovalOverrideQty(id: string, qty: number): void {
  db.update(pendingApprovals).set({ overrideQty: qty }).where(eq(pendingApprovals.id, id)).run();
}

/**
 * Find all pending approvals older than the given cutoff timestamp.
 * @param olderThanIso - ISO timestamp; approvals created before this are candidates for expiry
 * @returns Array of approval rows to expire
 */
export function findExpiredPending(olderThanIso: string): ApprovalRow[] {
  const rows = db
    .select()
    .from(pendingApprovals)
    .where(
      and(eq(pendingApprovals.status, "pending"), lt(pendingApprovals.createdAt, olderThanIso)),
    )
    .all();

  return rows.map((row) => ({
    ...row,
    status: row.status as ApprovalStatus,
  }));
}

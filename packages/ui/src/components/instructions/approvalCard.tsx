import type React from "react";

import type { Approval, ParsedInstruction } from "../../lib/api";
import { formatPriceOrDash } from "../../lib/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type ApprovalStatusVariant = "pos" | "neg" | "warn" | "neutral";

const STATUS_VARIANT: Record<string, ApprovalStatusVariant> = {
  pending: "warn",
  approved: "pos",
  rejected: "neg",
};

function resolveStatusVariant(status: string): ApprovalStatusVariant {
  return STATUS_VARIANT[status] ?? "neutral";
}

type ElapsedTone = "fresh" | "warn" | "urgent";

const ELAPSED_CLASS: Record<ElapsedTone, string> = {
  fresh: "text-fg-faint",
  warn: "text-warn",
  urgent: "text-neg",
};

function resolveElapsed(createdAt: string): { text: string; tone: ElapsedTone } {
  const diffMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (diffMinutes < 2) return { text: "just now", tone: "fresh" };
  if (diffMinutes < 10) return { text: `${String(diffMinutes)}m ago`, tone: "warn" };
  return { text: `${String(diffMinutes)}m ago`, tone: "urgent" };
}

function formatEntry(parsed: ParsedInstruction): string {
  if (parsed.entryLow != null && parsed.entryHigh != null) {
    return `${formatPriceOrDash(parsed.entryLow)}–${formatPriceOrDash(parsed.entryHigh)}`;
  }
  return formatPriceOrDash(parsed.entryLow);
}

function formatTarget(parsed: ParsedInstruction, index: number): string {
  const target = parsed.targets[index];
  if (target === undefined) return "—";
  return `${formatPriceOrDash(target.price)}${target.isOpenEnded ? "+" : ""}`;
}

type ApprovalCardProperties = {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  actionError: string | null;
};

/**
 * Pending buy-approval card (handoff.md §4 `ApprovalCard.tsx`) — parsed
 * instruction fields (entry/SL/targets), suggested qty, elapsed time since
 * creation, and approve/reject actions. Renders an expired-state message
 * instead of actions once an approval times out.
 * @param props.approval - the approval to render
 * @param props.onApprove - called with the approval id when Approve is clicked
 * @param props.onReject - called with the approval id when Reject is clicked
 * @param props.approvePending - whether the approve mutation is in flight
 * @param props.rejectPending - whether the reject mutation is in flight
 * @param props.actionError - error message from a failed approve/reject, if any
 * @returns Approval card element
 */
export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
  actionError,
}: ApprovalCardProperties): React.ReactElement {
  const parsed = approval.parsedInstruction;
  const elapsed = resolveElapsed(approval.createdAt);
  const isExpired = approval.status === "expired";
  const isSettled = approval.status !== "pending";

  return (
    <Card className="flex flex-col gap-3" danger={isExpired}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-body-sm font-semibold uppercase text-fg">
            {approval.symbol}
          </div>
          <div className="font-mono text-caption text-fg-faint">#{approval.id.slice(0, 8)}</div>
        </div>
        <Badge variant={resolveStatusVariant(approval.status)}>{approval.status}</Badge>
      </div>

      {parsed !== null && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border-strong bg-surface-2 p-2.5">
            <div className="text-micro uppercase tracking-wide text-fg-faint">Entry</div>
            <div className="font-mono text-body-sm text-fg">{formatEntry(parsed)}</div>
          </div>
          <div className="rounded-lg border border-border-strong bg-surface-2 p-2.5">
            <div className="text-micro uppercase tracking-wide text-fg-faint">Stop-loss</div>
            <div className="font-mono text-body-sm text-neg">
              {formatPriceOrDash(parsed.stopLoss)}
            </div>
          </div>
          <div className="rounded-lg border border-border-strong bg-surface-2 p-2.5">
            <div className="text-micro uppercase tracking-wide text-fg-faint">Target 1</div>
            <div className="font-mono text-body-sm text-pos">{formatTarget(parsed, 0)}</div>
          </div>
          <div className="rounded-lg border border-border-strong bg-surface-2 p-2.5">
            <div className="text-micro uppercase tracking-wide text-fg-faint">Target 2</div>
            <div className="font-mono text-body-sm text-pos">{formatTarget(parsed, 1)}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-caption">
        <span className="text-fg-muted">
          Qty <span className="text-fg">{approval.suggestedQty}</span>
        </span>
        <span className={ELAPSED_CLASS[elapsed.tone]}>{elapsed.text}</span>
      </div>

      {actionError !== null && <p className="text-caption text-neg">{actionError}</p>}

      {isExpired ? (
        <p className="rounded-lg bg-surface-2 py-2 text-center text-caption text-fg-faint">
          Expired — auto-rejected after timeout
        </p>
      ) : (
        !isSettled && (
          <div className="flex gap-2.5">
            <Button
              variant="primary"
              disabled={approvePending || rejectPending}
              onClick={() => {
                onApprove(approval.id);
              }}
            >
              {approvePending ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="destructive"
              disabled={approvePending || rejectPending}
              onClick={() => {
                onReject(approval.id);
              }}
            >
              {rejectPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        )
      )}
    </Card>
  );
}

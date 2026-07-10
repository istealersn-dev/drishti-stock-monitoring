import type React from "react";
import { useEffect, useState } from "react";

import type { Approval, ParsedInstruction } from "../../lib/api";
import { formatPriceOrDash } from "../../lib/format";
import { Badge, type BadgeVariant } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog } from "../ui/dialog";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warn",
  approved: "pos",
  rejected: "neg",
};

function resolveStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT[status] ?? "neutral";
}

// "Awaiting" matches Drishti.dc.html's pending-approval badge copy — the
// backend's own status value stays "pending" (ApprovalStatus in
// packages/agent), this is purely the display label.
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

function resolveStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
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
  const { entryLow, entryHigh } = parsed;
  if (entryLow !== null && entryHigh !== null) {
    return `${formatPriceOrDash(entryLow)}–${formatPriceOrDash(entryHigh)}`;
  }
  // Previously always formatted entryLow here, so an entryHigh-only
  // instruction silently rendered "—" instead of its one known bound.
  return formatPriceOrDash(entryLow ?? entryHigh);
}

/**
 * Estimated order value at the midpoint entry price (CLAUDE.md — "the agent
 * calculates suggested qty from available cash/margin at the midpoint entry
 * price"), matching Drishti.dc.html's "est ₹X" footer figure.
 * @param parsed - the parsed instruction, or null if parsing failed
 * @param suggestedQty - the agent's suggested order quantity
 * @returns the estimated value in rupees, or null if no entry price is available
 */
function estimateOrderValue(parsed: ParsedInstruction | null, suggestedQty: number): number | null {
  if (parsed === null) return null;
  const { entryLow, entryHigh } = parsed;
  if (entryLow !== null && entryHigh !== null) return ((entryLow + entryHigh) / 2) * suggestedQty;
  if (entryLow !== null) return entryLow * suggestedQty;
  if (entryHigh !== null) return entryHigh * suggestedQty;
  return null;
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
  onUpdateAmount: (id: string, amountInr: number) => void;
  approvePending: boolean;
  rejectPending: boolean;
  amountPending: boolean;
  actionError: string | null;
};

/**
 * Pending buy-approval card (handoff.md §4 `ApprovalCard.tsx`) — parsed
 * instruction fields (entry/SL/targets), suggested qty, elapsed time since
 * creation, and approve/reject actions. Reject goes through a Radix Dialog
 * confirm (handoff.md §5: "approve/reject instruction" is named alongside
 * GTT cancel as a destructive mutation requiring a confirm step). Only ever
 * rendered for `status === "pending"` approvals (the caller filters
 * settled/expired ones out before this point), so it doesn't carry a
 * separate settled/expired display state.
 * @param props.approval - the pending approval to render
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
  onUpdateAmount,
  approvePending,
  rejectPending,
  amountPending,
  actionError,
}: ApprovalCardProperties): React.ReactElement {
  const parsed = approval.parsedInstruction;
  const elapsed = resolveElapsed(approval.createdAt);
  const effectiveQty = approval.overrideQty ?? approval.suggestedQty;
  const estimatedValue = estimateOrderValue(parsed, effectiveQty);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState(
    estimatedValue !== null ? String(Math.round(estimatedValue)) : "",
  );

  // Keep the draft in sync with the server's estimate (e.g. after a Slack-side
  // edit) unless the approver is actively typing, so the 30s poll doesn't
  // stomp on an in-progress edit.
  useEffect(() => {
    if (!isEditingAmount) {
      setAmountDraft(estimatedValue !== null ? String(Math.round(estimatedValue)) : "");
    }
  }, [estimatedValue, isEditingAmount]);

  const commitAmountEdit = (): void => {
    setIsEditingAmount(false);
    const amountInr = Number(amountDraft);
    const unchanged = estimatedValue !== null && Math.round(estimatedValue) === amountInr;
    if (!amountDraft || !Number.isFinite(amountInr) || amountInr <= 0 || unchanged) {
      setAmountDraft(estimatedValue !== null ? String(Math.round(estimatedValue)) : "");
      return;
    }
    onUpdateAmount(approval.id, amountInr);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-body-sm font-semibold text-fg">
            {parsed?.stockName ?? approval.symbol}
          </div>
          <div className="font-mono text-caption uppercase text-fg-faint">{approval.symbol}</div>
        </div>
        <Badge variant={resolveStatusVariant(approval.status)}>
          {resolveStatusLabel(approval.status)}
        </Badge>
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
        <span className="flex items-center gap-1.5 text-fg-muted">
          Qty <span className="text-fg">{effectiveQty}</span>
          {estimatedValue !== null && (
            <>
              {" "}
              · ₹
              <input
                type="number"
                min="1"
                inputMode="decimal"
                aria-label="Order amount in rupees"
                className="w-24 rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-caption text-fg disabled:opacity-60"
                value={amountDraft}
                disabled={amountPending || approvePending || rejectPending}
                onFocus={() => {
                  setIsEditingAmount(true);
                }}
                onChange={(event) => {
                  setAmountDraft(event.target.value);
                }}
                onBlur={commitAmountEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              {amountPending && <span className="text-fg-faint">updating…</span>}
            </>
          )}
        </span>
        <span className={ELAPSED_CLASS[elapsed.tone]}>{elapsed.text}</span>
      </div>

      {/* Same 8-char id prefix format as GttCard/GttTable's "Approval" line,
          so a GTT row spawned from this card can be cross-referenced back to
          it — a hover-only tooltip isn't reachable on the mobile shell. */}
      <div className="text-caption text-fg-faint">
        Approval <span className="font-mono">{approval.id.slice(0, 8)}</span>
      </div>

      {actionError !== null && <p className="text-caption text-neg">{actionError}</p>}

      <div className="flex gap-2.5">
        <Button
          variant="primary"
          disabled={approvePending || rejectPending || amountPending}
          onClick={() => {
            onApprove(approval.id);
          }}
        >
          {approvePending ? "Approving…" : "Approve"}
        </Button>
        <Dialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
          <Dialog.Trigger>
            <Button
              variant="destructive"
              disabled={approvePending || rejectPending || amountPending}
            >
              {rejectPending ? "Rejecting…" : "Reject"}
            </Button>
          </Dialog.Trigger>
          <Dialog.Content
            title="Reject this instruction?"
            description={`This will reject the buy instruction for ${approval.symbol}. This cannot be undone.`}
            tone="destructive"
          >
            <Dialog.Footer>
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectConfirmOpen(false);
                }}
              >
                Keep pending
              </Button>
              <Button
                variant="destructive"
                disabled={rejectPending}
                onClick={() => {
                  setRejectConfirmOpen(false);
                  onReject(approval.id);
                }}
              >
                {rejectPending ? "Rejecting…" : "Confirm reject"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      </div>
    </Card>
  );
}

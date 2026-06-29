import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Spinner } from "../components/ui/spinner";
import {
  type Approval,
  type ParsedInstruction,
  approveInstruction,
  fetchApprovals,
  rejectInstruction,
  submitInstruction,
} from "../lib/api";

const EXAMPLE_CHIPS = [
  "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+",
  "HDFC Bank Buy 1700 SL 1600 Tgt 1850 2000",
  "Infosys Buy 1480-1510 SL 1420 Tgt 1620",
] as const;

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function elapsedLabel(createdAt: string): { text: string; cls: string } {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2) return { text: "just now", cls: "elapsed-fresh" };
  if (diffMin < 10) return { text: `${diffMin}m ago`, cls: "elapsed-warning" };
  return { text: `${diffMin}m ago`, cls: "elapsed-urgent" };
}

type ApprovalCardProperties = {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  actionError: string | null;
};

function ApprovalCard({
  approval,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
  actionError,
}: ApprovalCardProperties): React.ReactElement {
  const parsed: ParsedInstruction | null = approval.parsedInstruction;
  const elapsed = elapsedLabel(approval.createdAt);
  const isExpired = approval.status === "expired";
  const isSettled = approval.status !== "pending";

  const entryString =
    parsed?.entryLow != null && parsed?.entryHigh != null
      ? `${formatPrice(parsed.entryLow)}–${formatPrice(parsed.entryHigh)}`
      : parsed?.entryLow != null
        ? formatPrice(parsed.entryLow)
        : "—";

  const t1 = parsed?.targets[0];
  const t2 = parsed?.targets[1];
  const t1String = t1 != null ? `${formatPrice(t1.price)}${t1.isOpenEnded ? "+" : ""}` : "—";
  const t2String = t2 != null ? `${formatPrice(t2.price)}${t2.isOpenEnded ? "+" : ""}` : "—";

  return (
    <div className={`approval-card ${isSettled ? "opacity-50" : ""}`}>
      {/* Header */}
      <div className="mb-[13px] flex items-start justify-between gap-[10px]">
        <div>
          <div className="text-[13.5px] font-semibold text-text-primary">{approval.symbol}</div>
          <div className="mt-[2px] font-mono text-[11.5px] text-[#a5b4fc]">
            #{approval.id.slice(0, 8)}
          </div>
        </div>
        <span className="rounded-[5px] bg-[rgba(120,120,120,.1)] px-[9px] py-[3px] text-[11px] font-semibold text-text-tertiary">
          {approval.status}
        </span>
      </div>

      {/* Detail fields */}
      {parsed != null && (
        <div className="mb-[13px] grid grid-cols-2 gap-[9px]">
          <div className="approval-detail-field">
            <div className="mb-[3px] text-[10px] text-text-dim">Entry</div>
            <div className="font-mono text-[12.5px] text-[#e0e0e0]">{entryString}</div>
          </div>
          <div className="approval-detail-field">
            <div className="mb-[3px] text-[10px] text-text-dim">Stop-loss</div>
            <div className="font-mono text-[12.5px] text-[#f0a0a0]">
              {formatPrice(parsed.stopLoss)}
            </div>
          </div>
          <div className="approval-detail-field">
            <div className="mb-[3px] text-[10px] text-text-dim">Target 1</div>
            <div className="font-mono text-[12.5px] text-[#bdf0c8]">{t1String}</div>
          </div>
          <div className="approval-detail-field">
            <div className="mb-[3px] text-[10px] text-text-dim">Target 2</div>
            <div className="font-mono text-[12.5px] text-[#bdf0c8]">{t2String}</div>
          </div>
        </div>
      )}

      {/* Qty + elapsed */}
      <div className="mb-[13px] flex items-center justify-between font-mono text-[11.5px]">
        <span className="text-text-tertiary">
          Qty <span className="text-[#e0e0e0]">{approval.suggestedQty}</span>
        </span>
        <span className={elapsed.cls}>{elapsed.text}</span>
      </div>

      {/* Actions */}
      {actionError != null && (
        <div className="mb-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
          {actionError}
        </div>
      )}

      {isExpired ? (
        <div className="rounded-lg bg-[#161616] py-2 text-center text-[12px] text-text-dim">
          Expired — auto-rejected after timeout
        </div>
      ) : !isSettled ? (
        <div className="flex gap-[9px]">
          <button
            type="button"
            className="approval-approve-btn"
            disabled={approvePending || rejectPending}
            onClick={() => {
              onApprove(approval.id);
            }}
          >
            {approvePending ? <Spinner size="sm" /> : "Approve"}
          </button>
          <button
            type="button"
            className="approval-reject-btn"
            disabled={approvePending || rejectPending}
            onClick={() => {
              onReject(approval.id);
            }}
          >
            {rejectPending ? <Spinner size="sm" /> : "Reject"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Instructions page — buy instruction input, example chips, and pending approvals grid.
 * @returns Instructions page element
 */
export function Instructions(): React.ReactElement {
  const [instructionText, setInstructionText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Partial<Record<string, string>>>({});
  const [pendingApproveIds, setPendingApproveIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingRejectIds, setPendingRejectIds] = useState<ReadonlySet<string>>(new Set());
  const queryClientInstance = useQueryClient();

  const {
    data: approvals = [],
    isLoading,
    isError: approvalsError,
  } = useQuery({
    queryKey: ["approvals"],
    queryFn: fetchApprovals,
    refetchInterval: 30_000,
  });

  const submitMutation = useMutation({
    mutationFn: submitInstruction,
    onSuccess: (result) => {
      setSubmitSuccess(
        `Approval card created for ${result.symbol} (#${result.approvalId.slice(0, 8)})`,
      );
      setSubmitError(null);
      setInstructionText("");
      void queryClientInstance.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
      setSubmitSuccess(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveInstruction,
    onSuccess: (_data, id) => {
      setPendingApproveIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      void queryClientInstance.invalidateQueries({ queryKey: ["approvals"] });
      void queryClientInstance.invalidateQueries({ queryKey: ["gtt"] });
    },
    onError: (error: Error, id: string) => {
      setPendingApproveIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setActionErrors((previous) => ({ ...previous, [id]: `Approve failed: ${error.message}` }));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectInstruction,
    onSuccess: (_data, id) => {
      setPendingRejectIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      void queryClientInstance.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error, id: string) => {
      setPendingRejectIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setActionErrors((previous) => ({ ...previous, [id]: `Reject failed: ${error.message}` }));
    },
  });

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!instructionText.trim()) return;
    submitMutation.mutate(instructionText.trim());
  };

  const handleApprove = (id: string): void => {
    if (pendingApproveIds.has(id) || pendingRejectIds.has(id)) return;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setPendingApproveIds((previous) => new Set(previous).add(id));
    approveMutation.mutate(id);
  };

  const handleReject = (id: string): void => {
    if (pendingApproveIds.has(id) || pendingRejectIds.has(id)) return;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setPendingRejectIds((previous) => new Set(previous).add(id));
    rejectMutation.mutate(id);
  };

  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  return (
    <div className="animate-fade-drk max-w-[940px] space-y-4">
      {/* Send instruction card */}
      <div className="settings-card">
        <div className="mb-3 text-[13px] font-semibold text-text-primary">
          Send a buy instruction
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex items-stretch gap-[10px]">
            <input
              type="text"
              value={instructionText}
              onChange={(event) => {
                setInstructionText(event.target.value);
                setSubmitError(null);
                setSubmitSuccess(null);
              }}
              placeholder="Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
              className="instr-input"
              autoComplete="off"
            />
            <button
              type="submit"
              className="instr-send-btn"
              disabled={!instructionText.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>

          <div className="mt-[9px] font-mono text-[11.5px] text-text-dim">
            Format: [Stock] Buy [entry or range] SL [price] Tgt [T1] [T2+]
          </div>

          <div className="mt-[13px] flex flex-wrap gap-2">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="instr-example-chip"
                onClick={() => {
                  setInstructionText(chip);
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </form>

        {submitError != null && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
            {submitError}
          </div>
        )}
        {submitSuccess != null && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12px] text-success-text">
            {submitSuccess}
          </div>
        )}
      </div>

      {/* Pending approvals section */}
      <div className="flex items-center gap-[9px]">
        <span className="text-[13px] font-semibold text-text-primary">Pending approvals</span>
        {pendingApprovals.length > 0 && (
          <span className="rounded-md bg-[rgba(245,158,11,.12)] px-[9px] py-[2px] font-mono text-[11px] text-warning">
            {pendingApprovals.length}
          </span>
        )}
      </div>

      {approvalsError && approvals.length === 0 ? (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-[12px] text-danger-text">
          Failed to load approvals. Is the agent running?
        </div>
      ) : isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="settings-card py-[44px] text-center">
          <div className="text-[13.5px] font-medium text-text-tertiary">No pending approvals</div>
          <div className="mt-[6px] text-[12px] text-text-dim">Send a buy instruction above.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          {pendingApprovals.map((approval: Approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onReject={handleReject}
              approvePending={pendingApproveIds.has(approval.id)}
              rejectPending={pendingRejectIds.has(approval.id)}
              actionError={actionErrors[approval.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

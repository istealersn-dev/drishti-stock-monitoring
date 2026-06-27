import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import {
  approveInstruction,
  fetchApprovals,
  rejectInstruction,
  submitInstruction,
  type Approval,
  type ParsedInstruction,
} from "../lib/api";

const PLACEHOLDER = "e.g. Ramco Systems Buy 560-580 SL 520 Tgt 680 800+";

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

  return (
    <Card accent="warning" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-primary">{approval.symbol}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-muted">
            {new Date(approval.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <Badge variant="warning" dot>
          pending
        </Badge>
      </div>

      {parsed && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-dim bg-bg-inset p-3 text-[12px]">
          {(parsed.entryLow !== null || parsed.entryHigh !== null) && (
            <div>
              <span className="text-text-muted">Entry</span>
              <p className="font-mono text-text-primary">
                {parsed.entryLow !== null ? String(parsed.entryLow) : "?"}–
                {parsed.entryHigh !== null ? String(parsed.entryHigh) : "?"}
              </p>
            </div>
          )}
          {parsed.stopLoss !== null && (
            <div>
              <span className="text-text-muted">Stop Loss</span>
              <p className="font-mono text-danger-text">{String(parsed.stopLoss)}</p>
            </div>
          )}
          {parsed.targets.length > 0 && (
            <div className="col-span-2">
              <span className="text-text-muted">Targets</span>
              <p className="font-mono text-success-text">
                {parsed.targets
                  .map((t) => (t.isOpenEnded ? `${String(t.price)}+` : String(t.price)))
                  .join(", ")}
              </p>
            </div>
          )}
          <div>
            <span className="text-text-muted">Suggested Qty</span>
            <p className="font-mono text-text-primary">{approval.suggestedQty}</p>
          </div>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
          {actionError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => {
            onApprove(approval.id);
          }}
          disabled={approvePending || rejectPending}
        >
          {approvePending ? <Spinner size="sm" /> : "✓ Approve"}
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => {
            onReject(approval.id);
          }}
          disabled={approvePending || rejectPending}
        >
          {rejectPending ? <Spinner size="sm" /> : "✕ Reject"}
        </button>
      </div>
    </Card>
  );
}

/**
 * Instructions page — buy instruction input and pending approvals list.
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

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInstructionText(event.target.value);
    setSubmitError(null);
    setSubmitSuccess(null);
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

  return (
    <div className="animate-fade-drk space-y-5">
      <h1 className="text-[17px] font-semibold text-text-primary">Instructions</h1>

      <Card accent="indigo">
        <p className="mb-3 text-[13px] font-medium text-text-secondary">New Buy Instruction</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={instructionText}
            onChange={handleTextChange}
            placeholder={PLACEHOLDER}
            rows={3}
            className="w-full resize-none rounded-lg border border-border-default bg-bg-inset px-3 py-2 font-mono text-[13px] text-text-primary placeholder:text-text-dim focus:border-primary focus:outline-none"
          />
          {submitError && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12px] text-success-text">
              {submitSuccess}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={!instructionText.trim() || submitMutation.isPending}
          >
            {submitMutation.isPending ? <Spinner size="sm" /> : "Submit"}
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-text-secondary">Pending Approvals</p>
          {approvals.length > 0 && <Badge variant="warning">{approvals.length} pending</Badge>}
        </div>

        {approvalsError ? (
          <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-[12px] text-danger-text">
            Failed to load approvals. Is the agent running?
          </div>
        ) : isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-card border border-border-dim text-text-muted">
            No pending approvals
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval: Approval) => (
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
    </div>
  );
}

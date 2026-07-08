import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { ApprovalCard } from "../components/instructions/approvalCard";
import { InstructionComposer } from "../components/instructions/instructionComposer";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import {
  type Approval,
  approveInstruction,
  fetchApprovals,
  rejectInstruction,
  submitInstruction,
} from "../lib/api";

/**
 * Instructions page (Design.md/handoff.md §3 "buy-instruction + approvals")
 * — a composer for free-text buy instructions and a grid of pending
 * approval cards.
 * @returns Instructions page element
 */
export function Instructions(): React.ReactElement {
  const [instructionText, setInstructionText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Partial<Record<string, string>>>({});
  const [pendingApproveIds, setPendingApproveIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingRejectIds, setPendingRejectIds] = useState<ReadonlySet<string>>(new Set());
  const queryClient = useQueryClient();

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
      setSubmitSuccess(`${result.symbol} validated — preparing approval card, check back shortly.`);
      setSubmitError(null);
      setInstructionText("");
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
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
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["gtt"] });
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
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
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

  const handleSubmit = (): void => {
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

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <InstructionComposer
        value={instructionText}
        onChange={(value) => {
          setInstructionText(value);
          setSubmitError(null);
          setSubmitSuccess(null);
        }}
        onSubmit={handleSubmit}
        isPending={submitMutation.isPending}
        submitError={submitError}
        submitSuccess={submitSuccess}
      />

      <div className="flex items-center gap-2">
        <h2 className="text-title font-semibold text-fg">Pending approvals</h2>
        {pendingApprovals.length > 0 && <Badge variant="warn">{pendingApprovals.length}</Badge>}
      </div>

      {approvalsError && approvals.length === 0 ? (
        <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
          Failed to load approvals. Is the agent running?
        </div>
      ) : isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No pending approvals</p>
          <p className="text-caption text-fg-faint">Send a buy instruction above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 nav:grid-cols-2">
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

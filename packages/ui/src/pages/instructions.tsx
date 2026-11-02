import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { ApprovalCard } from "../components/instructions/approvalCard";
import { ApprovalSegments } from "../components/instructions/approvalSegments";
import type { ApprovalSource } from "../components/instructions/approvalSource";
import { InstructionComposer } from "../components/instructions/instructionComposer";
import { PageHeader } from "../components/shell/pageHeader";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  type Approval,
  approveInstruction,
  fetchApprovals,
  rejectInstruction,
  submitInstruction,
  updateApprovalAmount,
} from "../lib/api";

// The agent doesn't raise its own proposals yet — every approval is a buy
// instruction the user sent — so "From Drishti" says so instead of showing a count.

/**
 * Approvals page (updated design) — "From Drishti" holds the agent's own
 * proposals; "From you" holds the buy-instruction composer and the pending
 * approval cards it produces. Opens on "From you" while that's the only tab
 * with content, so a pending approval is never hidden behind an empty tab
 * during its timeout window.
 * @returns Approvals page element
 */
export function Instructions(): React.ReactElement {
  const [instructionText, setInstructionText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Partial<Record<string, string>>>({});
  const [pendingApproveIds, setPendingApproveIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingRejectIds, setPendingRejectIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingAmountIds, setPendingAmountIds] = useState<ReadonlySet<string>>(new Set());
  const [segment, setSegment] = useState<ApprovalSource>("you");
  const isDesktop = useIsDesktop();
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

  const amountMutation = useMutation({
    mutationFn: ({ id, amountInr }: { id: string; amountInr: number }) =>
      updateApprovalAmount(id, amountInr),
    onSuccess: (_data, { id }) => {
      setPendingAmountIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error, { id }) => {
      setPendingAmountIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setActionErrors((previous) => ({
        ...previous,
        [id]: `Update amount failed: ${error.message}`,
      }));
    },
  });

  const handleUpdateAmount = (id: string, amountInr: number): void => {
    if (pendingApproveIds.has(id) || pendingRejectIds.has(id) || pendingAmountIds.has(id)) return;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setPendingAmountIds((previous) => new Set(previous).add(id));
    amountMutation.mutate({ id, amountInr });
  };

  const handleSubmit = (): void => {
    if (!instructionText.trim()) return;
    submitMutation.mutate(instructionText.trim());
  };

  const handleApprove = (id: string): void => {
    if (pendingApproveIds.has(id) || pendingRejectIds.has(id) || pendingAmountIds.has(id)) return;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setPendingApproveIds((previous) => new Set(previous).add(id));
    approveMutation.mutate(id);
  };

  const handleReject = (id: string): void => {
    if (pendingApproveIds.has(id) || pendingRejectIds.has(id) || pendingAmountIds.has(id)) return;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setPendingRejectIds((previous) => new Set(previous).add(id));
    rejectMutation.mutate(id);
  };

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  // A 0 while loading or after a failed fetch would read as "nothing to do".
  const approvalsKnown = !isLoading && !(approvalsError && approvals.length === 0);
  const pendingCount = approvalsKnown ? pendingApprovals.length : null;

  return (
    <div className="flex max-w-[65rem] flex-col gap-4">
      <PageHeader
        title="Approvals"
        subtitle={
          isDesktop
            ? "Your buy instructions wait here for a decision. No new buy goes through until you approve."
            : "No new buy goes through until you approve."
        }
      />

      <ApprovalSegments active={segment} youCount={pendingCount} onSelect={setSegment} />

      {segment === "drishti" && (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pos-tint">
            <Check aria-hidden="true" className="h-5 w-5 text-pos" />
          </span>
          <p className="mt-1 text-body-sm font-medium text-fg">No proposals from Drishti</p>
          <p className="text-center text-caption text-fg-faint">
            {isDesktop
              ? "Drishti doesn't raise its own proposals yet. Your buy instructions are under From you."
              : "Drishti doesn't raise proposals yet."}
          </p>
        </div>
      )}

      {/* Stays mounted so a half-edited amount on an approval card survives a
          look at the other tab. */}
      <div className={`flex-col gap-4 ${segment === "you" ? "flex" : "hidden"}`}>
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
          <h2 className="text-body-sm font-semibold text-fg">Pending approvals</h2>
          {pendingCount !== null && <Badge variant="neutral">{pendingCount}</Badge>}
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
          <div className="grid grid-cols-1 items-start gap-3 lap:grid-cols-2">
            {pendingApprovals.map((approval: Approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={handleApprove}
                onReject={handleReject}
                onUpdateAmount={handleUpdateAmount}
                approvePending={pendingApproveIds.has(approval.id)}
                rejectPending={pendingRejectIds.has(approval.id)}
                amountPending={pendingAmountIds.has(approval.id)}
                actionError={actionErrors[approval.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

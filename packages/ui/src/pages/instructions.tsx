import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { ApprovalCard } from "../components/instructions/approvalCard";
import { ApprovalSegments } from "../components/instructions/approvalSegments";
import { InstructionComposer } from "../components/instructions/instructionComposer";
import { PageHeader } from "../components/shell/pageHeader";
import { Badge } from "../components/ui/badge";
import { ErrorNotice } from "../components/ui/errorNotice";
import { Spinner } from "../components/ui/spinner";
import {
  type Approval,
  approveInstruction,
  fetchApprovals,
  rejectInstruction,
  submitInstruction,
  updateApprovalAmount,
} from "../lib/api";
import { filterPendingApprovals } from "../lib/approvals";

type ApprovalAction = "approve" | "reject" | "amount";

const route = getRouteApi("/layout/instructions");

/**
 * Approvals page (updated design) — "From Drishti" is for the agent's own
 * proposals, which it doesn't raise yet, so that tab says so instead of showing
 * a count; "From you" holds the buy-instruction composer and the pending
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
  const [actionsInFlight, setActionsInFlight] = useState<ReadonlyMap<string, ApprovalAction>>(
    new Map(),
  );
  const { tab: segment = "you" } = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();

  const finishAction = (id: string): void => {
    setActionsInFlight((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  };

  // One action per approval at a time, so a double click can't approve twice.
  const startAction = (id: string, action: ApprovalAction): boolean => {
    if (actionsInFlight.has(id)) return false;
    setActionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setActionsInFlight((previous) => new Map(previous).set(id, action));
    return true;
  };

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
      finishAction(id);
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["gtt"] });
      void queryClient.invalidateQueries({ queryKey: ["holding-config"] });
    },
    onError: (error: Error, id: string) => {
      finishAction(id);
      setActionErrors((previous) => ({ ...previous, [id]: `Approve failed: ${error.message}` }));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectInstruction,
    onSuccess: (_data, id) => {
      finishAction(id);
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error, id: string) => {
      finishAction(id);
      setActionErrors((previous) => ({ ...previous, [id]: `Reject failed: ${error.message}` }));
    },
  });

  const amountMutation = useMutation({
    mutationFn: ({ id, amountInr }: { id: string; amountInr: number }) =>
      updateApprovalAmount(id, amountInr),
    onSuccess: (_data, { id }) => {
      finishAction(id);
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error, { id }) => {
      finishAction(id);
      setActionErrors((previous) => ({
        ...previous,
        [id]: `Update amount failed: ${error.message}`,
      }));
    },
  });

  const handleUpdateAmount = (id: string, amountInr: number): void => {
    if (startAction(id, "amount")) amountMutation.mutate({ id, amountInr });
  };

  const handleSubmit = (): void => {
    if (!instructionText.trim()) return;
    submitMutation.mutate(instructionText.trim());
  };

  const handleApprove = (id: string): void => {
    if (startAction(id, "approve")) approveMutation.mutate(id);
  };

  const handleReject = (id: string): void => {
    if (startAction(id, "reject")) rejectMutation.mutate(id);
  };

  const pendingApprovals = filterPendingApprovals(approvals);
  // A 0 while loading or after a failed fetch would read as "nothing to do".
  const approvalsKnown = !isLoading && !(approvalsError && approvals.length === 0);
  const pendingCount = approvalsKnown ? pendingApprovals.length : null;

  return (
    <div className="flex max-w-[65rem] flex-col gap-4">
      <PageHeader
        title="Approvals"
        subtitle="Your buy instructions wait here for a decision. No new buy goes through until you approve."
      />

      <ApprovalSegments
        active={segment}
        youCount={pendingCount}
        onSelect={(tab) => {
          void navigate({ search: { tab }, replace: true });
        }}
      />

      {segment === "drishti" && (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pos-tint">
            <Check aria-hidden="true" className="h-5 w-5 text-pos" />
          </span>
          <p className="mt-1 text-body-sm font-medium text-fg">No proposals from Drishti</p>
          <p className="text-center text-caption text-fg-faint">
            Drishti doesn't raise its own proposals yet. Your buy instructions are under From you.
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

        {approvalsError && approvals.length > 0 && (
          <p role="alert" className="text-caption text-neg">
            Couldn&apos;t refresh approvals, so these may be out of date.
          </p>
        )}

        {approvalsError && approvals.length === 0 ? (
          <ErrorNotice>Failed to load approvals. Is the agent running?</ErrorNotice>
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
                approvePending={actionsInFlight.get(approval.id) === "approve"}
                rejectPending={actionsInFlight.get(approval.id) === "reject"}
                amountPending={actionsInFlight.get(approval.id) === "amount"}
                actionError={actionErrors[approval.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

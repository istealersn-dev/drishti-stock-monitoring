import type React from "react";

import { Card } from "../ui/card";

type DangerCardProperties = {
  title: string;
  description: string;
  warning: string;
};

function DangerCard({ title, description, warning }: DangerCardProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border-strong p-3.5">
      <div className="text-body-sm font-medium text-fg">{title}</div>
      <p className="text-caption text-fg-faint">{description}</p>
      <p className="text-caption text-fg-muted">⚠ {warning}</p>
      <button
        type="button"
        disabled
        title="Not yet available — backend endpoint pending"
        className="mt-auto w-fit cursor-not-allowed rounded-xl bg-neg px-4 py-2 text-body-sm font-semibold text-fg"
      >
        Unavailable
      </button>
    </div>
  );
}

/**
 * Danger zone card (handoff.md §4 `DangerZone.tsx`) — irreversible
 * portfolio-wide actions, laid out as Drishti.dc.html's 3-column grid of
 * sub-cards. Only the "Danger zone" heading is red; every other label uses
 * standard text tokens, and each card's CTA is pinned bottom-left with a
 * solid red background regardless of the grid row's height (per user
 * request — a plain destructive-tint Button read too subtle here). All
 * three actions are disabled: the agent only exposes per-item cancel/reject
 * endpoints today, not bulk operations, so these are shown as a preview of
 * intent rather than live-but-fake controls a user could mistake for
 * working.
 * @returns Danger zone card element
 */
export function DangerZone(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3.5">
      <div>
        <h2 className="text-body-sm font-semibold text-neg">Danger zone</h2>
        <p className="mt-0.5 text-caption text-fg-faint">
          Irreversible actions. Not yet available — backend endpoints pending.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 nav:grid-cols-3">
        <DangerCard
          title="Cancel all active GTTs"
          description="Removes every pending trigger order from the agent and the broker in one action."
          warning="Positions run unprotected until triggers re-stage."
        />
        <DangerCard
          title="Reset agent logs"
          description="Permanently clears the entire audit trail of agent decisions and LLM reasoning."
          warning="Cannot be undone — there is no backup."
        />
        <DangerCard
          title="Reject all pending approvals"
          description="Declines every trade currently awaiting your sign-off in a single action."
          warning="Missed entries are not re-proposed automatically."
        />
      </div>
    </Card>
  );
}

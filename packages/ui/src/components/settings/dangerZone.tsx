import type React from "react";

import { Button } from "../ui/button";
import { Card } from "../ui/card";

type DangerRowProperties = {
  title: string;
  description: string;
  buttonLabel: string;
};

function DangerRow({ title, description, buttonLabel }: DangerRowProperties): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-body-sm font-medium text-fg">{title}</div>
        <p className="mt-0.5 text-caption text-fg-faint">{description}</p>
      </div>
      <Button variant="destructive" disabled title="Not yet available — backend endpoint pending">
        {buttonLabel}
      </Button>
    </div>
  );
}

/**
 * Danger zone card (handoff.md §4 `DangerZone.tsx`) — irreversible
 * portfolio-wide actions. All three actions are disabled: the agent only
 * exposes per-item cancel/reject endpoints today, not bulk operations, so
 * these are shown as a preview of intent rather than live-but-fake
 * controls a user could mistake for working.
 * @returns Danger zone card element
 */
export function DangerZone(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3" danger>
      <h2 className="text-body-sm font-semibold text-neg">Danger zone</h2>
      <p className="text-caption text-neg-soft">
        Irreversible actions. Not yet available — backend endpoints pending.
      </p>

      <DangerRow
        title="Cancel all active GTTs"
        description="Removes every pending trigger order"
        buttonLabel="Cancel all"
      />
      <DangerRow
        title="Reset agent logs"
        description="Permanently clears the audit trail"
        buttonLabel="Reset logs"
      />
      <DangerRow
        title="Reject all pending approvals"
        description="Declines every approval awaiting decision"
        buttonLabel="Reject all"
      />
    </Card>
  );
}

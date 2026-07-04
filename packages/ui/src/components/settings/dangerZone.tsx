import type React from "react";

import { Button } from "../ui/button";
import { Card } from "../ui/card";

type DangerRowProperties = {
  title: string;
  description: string;
  buttonLabel: string;
  onAction: () => void;
};

function DangerRow({
  title,
  description,
  buttonLabel,
  onAction,
}: DangerRowProperties): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-body-sm font-medium text-fg">{title}</div>
        <p className="mt-0.5 text-caption text-fg-faint">{description}</p>
      </div>
      <Button variant="destructive" onClick={onAction}>
        {buttonLabel}
      </Button>
    </div>
  );
}

/**
 * Danger zone card (handoff.md §4 `DangerZone.tsx`) — irreversible
 * portfolio-wide actions. All three actions have no backing endpoint yet
 * (the agent only exposes per-item cancel/reject, not bulk operations), so
 * they surface a stub alert rather than wiring to nothing real.
 * @returns Danger zone card element
 */
export function DangerZone(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3" danger>
      <h2 className="text-body-sm font-semibold text-neg">Danger zone</h2>
      <p className="text-caption text-neg-soft">Irreversible actions. Proceed with caution.</p>

      <DangerRow
        title="Cancel all active GTTs"
        description="Removes every pending trigger order"
        buttonLabel="Cancel all"
        onAction={() => {
          window.alert("Not yet wired — cancel all GTTs action pending backend endpoint.");
        }}
      />
      <DangerRow
        title="Reset agent logs"
        description="Permanently clears the audit trail"
        buttonLabel="Reset logs"
        onAction={() => {
          window.alert("Not yet wired — reset logs action pending backend endpoint.");
        }}
      />
      <DangerRow
        title="Reject all pending approvals"
        description="Declines every approval awaiting decision"
        buttonLabel="Reject all"
        onAction={() => {
          window.alert("Not yet wired — reject all approvals action pending backend endpoint.");
        }}
      />
    </Card>
  );
}

import type React from "react";

import type { GttOrder } from "../../lib/api";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

type GttCancelDialogProperties = {
  order: GttOrder;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
};

/**
 * Shared cancel-confirmation dialog for an active GTT order (handoff.md §5:
 * destructive mutations go through a Radix Dialog confirm) — used identically
 * by `GttTable`'s row and `GttCard`'s mobile presentation (both driven by
 * `useGttCancel`) so the confirm copy and button behavior can't drift
 * between the two presentations.
 * @param props.order - the GTT order being cancelled
 * @param props.confirmOpen - whether the confirm dialog is open
 * @param props.setConfirmOpen - open-state change handler
 * @param props.isPending - whether the cancel mutation is in flight
 * @param props.errorMessage - error message from a failed cancel, if any
 * @param props.onConfirm - called when the user confirms the cancel
 * @returns Cancel confirmation dialog element
 */
export function GttCancelDialog({
  order,
  confirmOpen,
  setConfirmOpen,
  isPending,
  errorMessage,
  onConfirm,
}: GttCancelDialogProperties): React.ReactElement {
  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <Dialog.Trigger>
        <Button variant="destructive" disabled={isPending}>
          {isPending ? "Cancelling…" : "Cancel"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content
        title="Cancel this GTT order?"
        description={`This will cancel the ${order.type.toUpperCase()} order for ${order.symbol}. This cannot be undone.`}
        tone="destructive"
      >
        {errorMessage !== null && <p className="text-caption text-neg">{errorMessage}</p>}
        <Dialog.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmOpen(false);
            }}
          >
            Keep order
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Cancelling…" : "Confirm cancel"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

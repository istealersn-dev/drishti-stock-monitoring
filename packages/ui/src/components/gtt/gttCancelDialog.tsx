import type React from "react";

import type { GttOrder } from "../../lib/api";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

import { useGttCancel } from "./useGttCancel";

type GttCancelDialogProperties = {
  order: GttOrder;
};

/**
 * Shared cancel-confirmation dialog for an active GTT order (handoff.md §5:
 * destructive mutations go through a Radix Dialog confirm) — used identically
 * by `GttTable`'s row and `GttCard`'s mobile presentation, so the confirm
 * copy and button behavior can't drift between the two presentations. Owns
 * its `useGttCancel` call so callers only ever need to pass the `order`.
 * @param props.order - the GTT order being cancelled
 * @returns Cancel confirmation dialog element
 */
export function GttCancelDialog({ order }: GttCancelDialogProperties): React.ReactElement {
  const { confirmOpen, setConfirmOpen, isPending, errorMessage, handleConfirmCancel } =
    useGttCancel(order.id);

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
          <Button variant="destructive" onClick={handleConfirmCancel} disabled={isPending}>
            {isPending ? "Cancelling…" : "Confirm cancel"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

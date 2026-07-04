import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { cancelGttOrder } from "../../lib/api";

type GttCancel = {
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  isPending: boolean;
  errorMessage: string | null;
  handleConfirmCancel: () => void;
};

/**
 * Shared cancel-confirmation state + mutation for one GTT order — used
 * identically by `GttTable`'s row and `GttCard`'s mobile presentation, so the
 * two can't drift in whether cancelling requires confirmation
 * (handoff.md §5: destructive mutations go through a Radix Dialog confirm).
 * @param orderId - the GTT order's id
 * @returns confirm-dialog state, mutation state, and the confirm handler
 */
export function useGttCancel(orderId: string): GttCancel {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => cancelGttOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gtt"] });
      setConfirmOpen(false);
    },
  });

  const handleConfirmCancel = (): void => {
    mutation.mutate();
  };

  return {
    confirmOpen,
    setConfirmOpen,
    isPending: mutation.isPending,
    errorMessage: mutation.error !== null ? mutation.error.message : null,
    handleConfirmCancel,
  };
}

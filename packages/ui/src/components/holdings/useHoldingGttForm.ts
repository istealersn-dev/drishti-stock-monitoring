import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { updateHoldingConfig } from "../../lib/api";

function parsePriceInput(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

type HoldingGttForm = {
  sl: string;
  setSl: (value: string) => void;
  target: string;
  setTarget: (value: string) => void;
  saveError: string | null;
  isPending: boolean;
  handleSetGtt: () => void;
};

/**
 * Shared SL/target form state + "Set GTT" mutation for one holding — used
 * identically by `HoldingsTable`'s desktop row and `HoldingCard`'s mobile
 * card (handoff.md §4: "share the row view-model") so the two presentations
 * can't drift in behavior.
 * @param symbol - the holding's trading symbol
 * @returns form state, change handlers, and the submit handler
 */
export function useHoldingGttForm(symbol: string): HoldingGttForm {
  const [sl, setSl] = useState("");
  const [target, setTarget] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (patch: {
      slThreshold: number;
      targetOne: number | null;
      targetTwo: number | null;
    }) => updateHoldingConfig(symbol, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gtt"] });
      setSaveError(null);
      setSl("");
      setTarget("");
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const handleSetGtt = (): void => {
    const slNumber = parsePriceInput(sl);
    if (slNumber === null || slNumber <= 0) {
      setSaveError("Enter a valid SL before setting GTT");
      return;
    }

    let targetNumber: number | null = null;
    if (target.trim()) {
      targetNumber = parsePriceInput(target);
      if (targetNumber === null || targetNumber <= 0) {
        setSaveError("Enter a valid target price, or leave it blank");
        return;
      }
    }

    mutation.mutate({ slThreshold: slNumber, targetOne: targetNumber, targetTwo: null });
  };

  return { sl, setSl, target, setTarget, saveError, isPending: mutation.isPending, handleSetGtt };
}

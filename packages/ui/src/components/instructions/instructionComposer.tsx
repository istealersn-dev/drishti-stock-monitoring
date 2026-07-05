import { Send } from "lucide-react";
import type React from "react";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

const EXAMPLE_CHIPS = [
  "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+",
  "HDFC Bank Buy 1700 SL 1600 Tgt 1850 2000",
  "Infosys Buy 1480-1510 SL 1420 Tgt 1620",
] as const;

type InstructionComposerProperties = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitError: string | null;
  submitSuccess: string | null;
};

/**
 * Buy-instruction composer (handoff.md §4 `InstructionComposer.tsx`) — a
 * free-text input plus example chips, submitted as a real `<form>`
 * (handoff.md §7: wrap the buy-instruction field in `<form>` with submit
 * semantics).
 * @param props.value - controlled instruction text
 * @param props.onChange - change handler for the instruction text
 * @param props.onSubmit - called on form submit
 * @param props.isPending - whether the submit mutation is in flight
 * @param props.submitError - error message from a failed submit, if any
 * @param props.submitSuccess - success message after a submit, if any
 * @returns Instruction composer element
 */
export function InstructionComposer({
  value,
  onChange,
  onSubmit,
  isPending,
  submitError,
  submitSuccess,
}: InstructionComposerProperties): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-body-sm font-semibold text-fg">Send a buy instruction</h2>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-stretch gap-2.5">
          <div className="flex-1">
            <Input
              id="instruction-text"
              label="Buy instruction"
              hideLabel
              value={value}
              onChange={onChange}
              placeholder="Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" disabled={!value.trim() || isPending}>
            <Send aria-hidden="true" className="h-4 w-4" />
            {isPending ? "Sending…" : "Send"}
          </Button>
        </div>

        <p className="font-mono text-caption text-fg-faint">
          Format: [Stock] Buy [entry or range] SL [price] Tgt [T1] [T2+]
        </p>

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                onChange(chip);
              }}
              className="cursor-pointer rounded-pill border border-border-strong bg-surface-2 px-3 py-1 font-mono text-caption text-fg-muted transition-colors hover:border-border-muted hover:text-fg"
            >
              {chip}
            </button>
          ))}
        </div>
      </form>

      {submitError !== null && <p className="text-caption text-neg">{submitError}</p>}
      {submitSuccess !== null && <p className="text-caption text-pos">{submitSuccess}</p>}
    </Card>
  );
}

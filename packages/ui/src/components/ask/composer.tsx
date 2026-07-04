import { Send } from "lucide-react";
import type React from "react";

import { Button } from "../ui/button";

type ComposerProperties = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
};

/**
 * Ask Drishti composer bar (handoff.md §9 — `sticky`, not `fixed`).
 * @param props.value - controlled question text
 * @param props.onChange - change handler, receives the new text
 * @param props.onSubmit - called when the form is submitted
 * @param props.disabled - disables the field and send button (e.g. while a request is pending)
 * @returns Composer form element
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: ComposerProperties): React.ReactElement {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="sticky bottom-0 flex items-center gap-2.5 border-t border-border bg-bg-base py-3"
    >
      <label htmlFor="ask-composer-input" className="sr-only">
        Ask Drishti
      </label>
      <input
        id="ask-composer-input"
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="Ask about a stock, sector, or your portfolio…"
        autoComplete="off"
        disabled={disabled}
        className="h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface-2 px-4 text-body text-fg outline-none transition-colors placeholder:text-fg-faint focus-visible:border-border-focus disabled:cursor-not-allowed disabled:text-fg-faint"
      />
      <Button
        type="submit"
        variant="primary"
        aria-label="Send"
        disabled={disabled || !value.trim()}
        className="h-11 w-11 flex-none !p-0"
      >
        <Send aria-hidden="true" className="h-4 w-4" />
      </Button>
    </form>
  );
}

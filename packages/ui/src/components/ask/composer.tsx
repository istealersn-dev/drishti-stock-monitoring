import { Send } from "lucide-react";
import type React from "react";

import { Button } from "../ui/button";

type ComposerProperties = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /**
   * "hero" (Drishti.dc.html's empty-state composer — taller, 2-row textarea,
   * shows the model pill) vs "conversation" (the sticky reply bar — single
   * row, no model pill). Defaults to "conversation".
   */
  variant?: "hero" | "conversation";
};

// The app is hardcoded to a single local LLM provider (CLAUDE.md — LM Studio,
// no BYO-provider/cloud API), so this is a static label, not fetched from an
// endpoint — there's nothing to select or configure.
const MODEL_LABEL = "gemma-4-12b · lm studio";

/**
 * Ask Drishti composer (handoff.md §9 — `sticky`, not `fixed`; Design.md §5's
 * hero variant matches Drishti.dc.html's bordered textarea box with a model
 * pill + round send button, not a plain single-line input bar).
 * @param props.value - controlled question text
 * @param props.onChange - change handler, receives the new text
 * @param props.onSubmit - called when the form is submitted
 * @param props.disabled - disables the field and send button (e.g. while a request is pending)
 * @param props.variant - "hero" (taller, model pill) or "conversation" (compact reply bar)
 * @returns Composer form element
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  variant = "conversation",
}: ComposerProperties): React.ReactElement {
  const isHero = variant === "hero";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={
        isHero
          ? "rounded-2xl border border-border-strong bg-surface-3 p-3.5 shadow-card transition-colors focus-within:border-border-focus"
          : "sticky bottom-0 flex items-center gap-2.5 border-t border-border bg-bg-base py-3"
      }
    >
      <label htmlFor="ask-composer-input" className="sr-only">
        Ask Drishti
      </label>
      {isHero ? (
        <>
          <textarea
            id="ask-composer-input"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask Drishti about your portfolio, the market, or SEBI rules…"
            rows={2}
            disabled={disabled}
            className="block w-full resize-none bg-transparent text-body text-fg outline-none placeholder:text-fg-faint disabled:text-fg-faint"
          />
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2 py-1 font-mono text-micro text-fg-muted">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pos" />
                {MODEL_LABEL}
              </span>
              <span className="font-mono text-micro text-fg-faint">Reads your live book</span>
            </div>
            <Button
              type="submit"
              variant="primary"
              aria-label="Send"
              disabled={disabled || !value.trim()}
              className="h-9 w-9 flex-none !p-0"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <input
            id="ask-composer-input"
            type="text"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            placeholder="Reply…"
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
        </>
      )}
    </form>
  );
}

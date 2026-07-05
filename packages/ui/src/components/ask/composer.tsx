import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import type React from "react";

import { HEALTH_CHECK_INTERVAL_MS } from "../../lib/agentStatus";
import { fetchHealth } from "../../lib/api";
import { LM_MODEL_SHORT_LABEL } from "../../lib/llmConfig";
import { Button } from "../ui/button";

type ComposerProperties = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /**
   * "hero" (empty-state — 2-row textarea, shows the "Reads your live book"
   * caption) vs "conversation" (sticky reply bar — single row, no caption).
   * Both use the identical bordered-box + model-pill layout in
   * Drishti.dc.html — they differ only in row count, placeholder, and the
   * caption, not in structure. Defaults to "conversation".
   */
  variant?: "hero" | "conversation";
};

/**
 * Ask Drishti composer (handoff.md §9 — `sticky`, not `fixed`) — a bordered
 * textarea box with a model-indicator pill and round send button, matching
 * Drishti.dc.html's composer exactly for both the hero and conversation
 * screens (the reference uses the identical box in both places).
 * @param props.value - controlled question text
 * @param props.onChange - change handler, receives the new text
 * @param props.onSubmit - called when the form is submitted
 * @param props.disabled - disables the field and send button (e.g. while a request is pending)
 * @param props.variant - "hero" (2-row, shows caption) or "conversation" (1-row, no caption)
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
  // Shares the ["health"] cache with BrokerCard — same query key, same
  // 5-minute interval override, so opening Ask Drishti alone doesn't spin up
  // a second, more frequent poll of the same live Upstox+LLM health check.
  const { isError: llmUnreachable } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: HEALTH_CHECK_INTERVAL_MS,
    refetchInterval: HEALTH_CHECK_INTERVAL_MS,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={`${isHero ? "" : "sticky bottom-0 "}rounded-2xl border border-border-strong bg-surface-3 p-3.5 shadow-card transition-colors focus-within:border-border-focus`}
    >
      <label htmlFor="ask-composer-input" className="sr-only">
        Ask Drishti
      </label>
      <textarea
        id="ask-composer-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          // isComposing guards IME composition (e.g. transliterated Hindi,
          // CJK): the Enter that confirms a candidate must not also submit
          // the still-in-progress message.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={
          isHero
            ? "Ask Drishti about your portfolio, the market, or SEBI rules…"
            : "Reply to Drishti…"
        }
        rows={isHero ? 2 : 1}
        disabled={disabled}
        className="block w-full resize-none bg-transparent text-body text-fg outline-none placeholder:text-fg-faint disabled:text-fg-faint"
      />
      <div className="mt-2 flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2 py-1 font-mono text-micro text-fg-muted">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${llmUnreachable ? "bg-neg" : "bg-pos"}`}
            />
            {LM_MODEL_SHORT_LABEL}
          </span>
          {isHero && (
            <span className="font-mono text-micro text-fg-faint">Reads your live book</span>
          )}
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
    </form>
  );
}

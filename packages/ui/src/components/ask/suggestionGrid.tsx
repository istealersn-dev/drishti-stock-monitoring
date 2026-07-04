import type React from "react";

const SUGGESTIONS = [
  "Which of my holdings are closest to their stop-loss?",
  "How much MTF interest have I paid this month?",
  "Summarize today's agent activity across all runs",
  "Which sectors is my portfolio overweight in?",
];

type SuggestionGridProperties = {
  onSelect: (suggestion: string) => void;
};

/**
 * Empty-state suggestion chips (Design.md §5 "hero + composer + suggestion
 * grid") — selecting one asks that question immediately.
 * @param props.onSelect - called with the suggestion text when a chip is chosen
 * @returns Suggestion grid element
 */
export function SuggestionGrid({ onSelect }: SuggestionGridProperties): React.ReactElement {
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 nav:grid-cols-2">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => {
            onSelect(suggestion);
          }}
          className="rounded-xl border border-border-strong bg-surface-2 px-4 py-3 text-left text-body-sm text-fg-soft transition-colors hover:border-border-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

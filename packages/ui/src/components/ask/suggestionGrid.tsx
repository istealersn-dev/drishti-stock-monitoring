import type React from "react";

// Category eyebrow + question, matching Drishti.dc.html's suggestion grid —
// the advisor's system prompt (packages/agent/.../advisor.prompts.ts) is
// genuinely SEBI-aware, so the SEBI/tax framing here reflects a real
// capability, not aspirational copy.
const SUGGESTIONS = [
  { category: "Risk", text: "Is my MTF exposure too high, and what does it cost me daily?" },
  {
    category: "Positions",
    text: "Which of my holdings are closest to their stop-loss right now?",
  },
  {
    category: "SEBI",
    text: "Explain the SEBI rules on MTF pledging and peak margin for my book.",
  },
  {
    category: "Tax",
    text: "Estimate my STCG vs LTCG if I exit my three largest positions today.",
  },
] as const;

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
      {SUGGESTIONS.map(({ category, text }) => (
        <button
          key={text}
          type="button"
          onClick={() => {
            onSelect(text);
          }}
          className="rounded-xl border border-border-strong bg-surface-2 px-4 py-3 text-left transition-colors hover:border-border-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <span className="mb-1 block font-mono text-caption font-semibold uppercase tracking-wide text-gold">
            {category}
          </span>
          <span className="block text-body-sm text-fg-soft">{text}</span>
        </button>
      ))}
    </div>
  );
}

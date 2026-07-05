import type React from "react";

/**
 * Assistant "is typing" indicator — 3 gold pulsing dots (Design.md §6,
 * matching Drishti.dc.html's `background:#c8a24a` dots — not a neutral
 * gray), meant to sit inside an assistant-role MessageBubble while a reply
 * streams in. Staggered via Tailwind arbitrary `animation-delay` values (not
 * a raw hex/px literal, so it doesn't trip the token guardrail) rather than
 * inline styles.
 * @returns Typing indicator element
 */
export function TypingIndicator(): React.ReactElement {
  return (
    <div role="status" aria-label="Assistant is typing" className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:300ms]" />
    </div>
  );
}

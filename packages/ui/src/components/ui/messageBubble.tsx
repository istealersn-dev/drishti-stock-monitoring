import { forwardRef } from "react";
import type React from "react";

type MessageBubbleProperties = {
  role: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
};

/**
 * Ask Drishti chat bubble (Design.md §6) — user messages are a translucent
 * gold wash (12% fill / 24% border, bright `fg` text — matching
 * Drishti.dc.html's `rgba(200,162,74,.12)` bubble, not a solid tint),
 * right-aligned. Assistant messages are NOT a bubble at all in the
 * reference — just the gold दृ avatar beside plain, unstyled text, so this
 * renders that instead of a symmetric bordered/surfaced counterpart.
 * Forwards its ref to the node `className` applies to (the bubble for
 * "user", the text block for "assistant") rather than the outer alignment
 * wrapper — a future `Tooltip`/`Dialog.Trigger asChild` anchored to a
 * message needs the ref to resolve to the visible content's own bounding
 * box, not the full-width flex wrapper.
 * @param props.role - who sent the message
 * @param props.children - message content
 * @param props.className - additional classes on the bubble/text node
 * @param ref - forwarded ref to the bubble (user) or text block (assistant)
 * @returns Message bubble element
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProperties>(
  function MessageBubble({ role, children, className = "" }, ref): React.ReactElement {
    if (role === "user") {
      return (
        <div className="flex justify-end">
          <div
            ref={ref}
            className={`max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-gold/[0.24] bg-gold/[0.12] px-4 py-2.5 text-body text-fg ${className}`}
          >
            {children}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-caption font-bold text-bg-base"
        >
          दृ
        </span>
        <div
          ref={ref}
          className={`min-w-0 flex-1 whitespace-pre-wrap pt-0.5 text-body text-fg-soft ${className}`}
        >
          {children}
        </div>
      </div>
    );
  },
);

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
 * right-aligned; assistant messages are surface, left-aligned. Forwards its
 * ref to the inner bubble `<div>` (the same node `className` applies to,
 * matching Badge/Card's ref+className co-location) rather than the outer
 * alignment wrapper — a future `Tooltip`/`Dialog.Trigger asChild` anchored
 * to a bubble (e.g. a "sent Xm ago" timestamp) needs the ref to resolve to
 * the visible bubble's own bounding box, not the full-width flex wrapper.
 * @param props.role - who sent the message
 * @param props.children - message content
 * @param props.className - additional classes on the bubble
 * @param ref - forwarded ref to the inner bubble `<div>`
 * @returns Message bubble element
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProperties>(
  function MessageBubble({ role, children, className = "" }, ref): React.ReactElement {
    const isUser = role === "user";
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          ref={ref}
          className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-body ${isUser ? "border border-gold/[0.24] bg-gold/[0.12] text-fg" : "border border-border-strong bg-surface text-fg"} ${className}`}
        >
          {children}
        </div>
      </div>
    );
  },
);

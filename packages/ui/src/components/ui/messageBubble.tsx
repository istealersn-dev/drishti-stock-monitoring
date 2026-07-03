import { forwardRef } from "react";
import type React from "react";

type MessageBubbleProperties = {
  role: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
};

/**
 * Ask Drishti chat bubble (Design.md §6) — user messages are gold-tint,
 * right-aligned; assistant messages are surface, left-aligned. Forwards its
 * ref to the outer wrapping `<div>` for the same reason Button/Badge/Card
 * do — a future `Tooltip`/`Dialog.Trigger asChild` anchored to a bubble
 * (e.g. a "sent Xm ago" timestamp) needs a real DOM node to attach to.
 * @param props.role - who sent the message
 * @param props.children - message content
 * @param props.className - additional classes on the bubble
 * @param ref - forwarded ref to the outer wrapping `<div>`
 * @returns Message bubble element
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProperties>(
  function MessageBubble({ role, children, className = "" }, ref): React.ReactElement {
    const isUser = role === "user";
    return (
      <div ref={ref} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-body ${isUser ? "bg-gold-tint text-bg-base" : "border border-border-strong bg-surface text-fg"} ${className}`}
        >
          {children}
        </div>
      </div>
    );
  },
);

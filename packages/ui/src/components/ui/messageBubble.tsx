import type React from "react";

type MessageBubbleProperties = {
  role: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
};

/**
 * Ask Drishti chat bubble (Design.md §6) — user messages are gold-tint,
 * right-aligned; assistant messages are surface, left-aligned.
 * @param props.role - who sent the message
 * @param props.children - message content
 * @param props.className - additional classes on the bubble
 * @returns Message bubble element
 */
export function MessageBubble({
  role,
  children,
  className = "",
}: MessageBubbleProperties): React.ReactElement {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-body ${isUser ? "bg-gold-tint text-bg-base" : "border border-border-strong bg-surface text-fg"} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

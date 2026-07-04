import type React from "react";

import { MessageBubble } from "../ui/messageBubble";
import { TypingIndicator } from "../ui/typingIndicator";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type MessageListProperties = {
  messages: Message[];
  pending: boolean;
};

/** Format an ISO timestamp to a short local time, e.g. "14:02". */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Ask Drishti conversation — renders each message as a `MessageBubble`
 * (Design.md §6) plus a trailing `TypingIndicator` while a question is
 * in flight.
 * @param props.messages - conversation messages in chronological order
 * @param props.pending - whether an assistant reply is currently being awaited
 * @returns Message list element
 */
export function MessageList({ messages, pending }: MessageListProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
        >
          <MessageBubble role={message.role}>{message.content}</MessageBubble>
          <span className="mt-1 px-1 font-mono text-micro text-fg-faint">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
      ))}
      {pending && (
        <MessageBubble role="assistant">
          <TypingIndicator />
        </MessageBubble>
      )}
    </div>
  );
}

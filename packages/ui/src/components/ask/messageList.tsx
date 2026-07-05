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

/**
 * Ask Drishti conversation — renders each message as a `MessageBubble`
 * (Design.md §6) plus a trailing `TypingIndicator` while a question is in
 * flight. No per-message timestamp — Drishti.dc.html doesn't show one.
 * @param props.messages - conversation messages in chronological order
 * @param props.pending - whether an assistant reply is currently being awaited
 * @returns Message list element
 */
export function MessageList({ messages, pending }: MessageListProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) => (
        <MessageBubble key={message.id} role={message.role}>
          {message.content}
        </MessageBubble>
      ))}
      {pending && (
        <MessageBubble role="assistant">
          <TypingIndicator />
        </MessageBubble>
      )}
    </div>
  );
}

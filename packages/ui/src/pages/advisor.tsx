import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Spinner } from "../components/ui/spinner";
import { type AdvisoryConversation, askAdvisor, fetchAdvisoryConversations } from "../lib/api";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

type SessionGroup = {
  sessionId: string;
  messages: AdvisoryConversation[];
};

function groupBySession(conversations: AdvisoryConversation[]): SessionGroup[] {
  const sorted = [...conversations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups: SessionGroup[] = [];
  for (const message of sorted) {
    const last = groups.at(-1);
    if (last != null && last.sessionId === message.sessionId) {
      last.messages.push(message);
    } else {
      groups.push({ sessionId: message.sessionId, messages: [message] });
    }
  }
  return groups;
}

type MessageBubbleProperties = {
  message: AdvisoryConversation;
};

function MessageBubble({ message }: MessageBubbleProperties): React.ReactElement {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-card px-[13px] py-[9px] text-[13px] leading-relaxed ${
          isUser
            ? "bg-primary/15 text-text-primary"
            : "border border-border-subtle bg-[#161616] text-text-secondary"
        }`}
      >
        {message.content}
      </div>
      <span className="mt-[3px] px-1 font-mono text-[10px] text-text-faint">
        {formatTimestamp(message.createdAt)}
      </span>
    </div>
  );
}

/**
 * Advisor page — chat-style interface for asking Drishti investment questions.
 * @returns Advisor page element
 */
export function Advisor(): React.ReactElement {
  const [question, setQuestion] = useState("");
  const [askError, setAskError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const queryClientInstance = useQueryClient();

  const {
    data: conversations = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["advisor-conversations"],
    queryFn: fetchAdvisoryConversations,
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: (q: string) => askAdvisor(q, sessionId),
    onSuccess: () => {
      setAskError(null);
      setQuestion("");
      void queryClientInstance.invalidateQueries({ queryKey: ["advisor-conversations"] });
    },
    onError: (error: Error) => {
      setAskError(error.message);
    },
  });

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;
    setAskError(null);
    mutation.mutate(trimmed);
  };

  const groups = groupBySession(conversations);

  return (
    <div className="animate-fade-drk flex h-full max-w-[860px] flex-col gap-[14px]">
      {/* Header */}
      <div>
        <h1 className="text-[16px] font-semibold text-text-primary">AI Advisor</h1>
        <p className="mt-[2px] text-[12px] text-text-dim">Ask Drishti for investment guidance</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-[12px] text-danger-text">
            Failed to load conversations. Is the agent running?
          </div>
        ) : conversations.length === 0 ? (
          <div className="settings-card py-[44px] text-center">
            <div className="text-[13.5px] font-medium text-text-tertiary">
              No conversations yet. Ask your first question below.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.sessionId} className="space-y-3">
                {group.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="sticky bottom-0 pt-1">
        {askError != null && (
          <div className="mb-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
            {askError}
          </div>
        )}
        <div className="flex items-stretch gap-[10px]">
          <input
            type="text"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setAskError(null);
            }}
            placeholder="Ask about a stock, sector, or your portfolio…"
            className="instr-input"
            autoComplete="off"
          />
          <button
            type="submit"
            className="instr-send-btn"
            disabled={!question.trim() || mutation.isPending}
          >
            {mutation.isPending ? <Spinner size="sm" /> : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { AmbientWave } from "../components/ask/ambientWave";
import { Composer } from "../components/ask/composer";
import { MessageList } from "../components/ask/messageList";
import { SuggestionGrid } from "../components/ask/suggestionGrid";
import { Breadcrumb } from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { askAdvisor, fetchAdvisoryConversations } from "../lib/api";

type View = "hero" | "conversation";

/** Local-time greeting matching Drishti.dc.html's `greeting` state (morning/afternoon/evening). */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

/**
 * Ask Drishti (Design.md §5) — empty-state hero (headline, suggestion grid,
 * ambient wave) that transitions to a conversation view the moment a
 * question is asked. The ambient wave unmounts as soon as `view` flips to
 * "conversation". "New chat" starts a fresh session id; the breadcrumb
 * crumb only returns to the hero view without discarding the session.
 * @returns Ask Drishti page element
 */
export function Ask(): React.ReactElement {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [view, setView] = useState<View>("hero");
  const [question, setQuestion] = useState("");
  const [askError, setAskError] = useState<string | null>(null);
  // useMutation's own `isPending` is a single boolean for the component's
  // lifetime, not scoped per session — tracking which session actually has a
  // request in flight lets "New chat" abandon a stale one instead of leaving
  // the fresh session's composer/typing-indicator driven by an unrelated,
  // still-settling request.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const isPendingForSession = pendingSessionId === sessionId;
  const queryClient = useQueryClient();

  // Read inside async mutation callbacks so a stale response (settling after
  // the user has since switched sessions via "New chat") can be told apart
  // from the still-current one, instead of blindly clearing `question`/
  // `askError` for whatever session happens to be active when it resolves.
  const sessionIdReference = useRef(sessionId);
  useEffect(() => {
    sessionIdReference.current = sessionId;
  }, [sessionId]);

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
    mutationFn: (text: string) => askAdvisor(text, sessionId),
  });

  const sessionMessages = conversations
    .filter((message) => message.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const handleAsk = (text: string): void => {
    const trimmed = text.trim();
    if (!trimmed || isPendingForSession) return;
    const askedForSession = sessionId;
    setAskError(null);
    setView("conversation");
    setPendingSessionId(askedForSession);
    mutation.mutate(trimmed, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["advisor-conversations"] });
        if (askedForSession !== sessionIdReference.current) return;
        setPendingSessionId(null);
        setAskError(null);
        setQuestion("");
      },
      onError: (error: Error) => {
        if (askedForSession !== sessionIdReference.current) return;
        setPendingSessionId(null);
        setAskError(error.message);
      },
    });
  };

  const handleReturnToHero = (): void => {
    setView("hero");
  };

  const handleNewChat = (): void => {
    setSessionId(crypto.randomUUID());
    setView("hero");
    setQuestion("");
    setAskError(null);
    setPendingSessionId(null);
  };

  if (view === "hero") {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6">
        <AmbientWave />
        <div className="relative z-10 flex w-full max-w-2xl flex-col gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-caption font-semibold uppercase tracking-wide text-gold">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
              SEBI-aware portfolio intelligence
            </div>
            <h1 className="text-display font-semibold text-fg">
              {timeOfDayGreeting()}
              <br />
              Ask me anything about your book.
            </h1>
            <p className="mt-3 max-w-xl text-body text-fg-muted">
              Drishti reads your live NSE / BSE holdings, MTF exposure and agent activity — and
              knows SEBI rules cold. Ask about risk, positions, tax, or compliance.
            </p>
          </div>
          <Composer
            variant="hero"
            value={question}
            onChange={setQuestion}
            onSubmit={() => {
              handleAsk(question);
            }}
            disabled={isPendingForSession}
          />
          <SuggestionGrid onSelect={handleAsk} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-[image:var(--gradient-gold)] font-mono text-micro font-bold text-bg-base"
          >
            दृ
          </span>
          <Breadcrumb
            items={[
              { label: "Ask Drishti", onClick: handleReturnToHero },
              { label: "Conversation" },
            ]}
          />
        </div>
        <Button variant="secondary" onClick={handleNewChat}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
            Failed to load conversation. Is the agent running?
          </div>
        ) : (
          <MessageList messages={sessionMessages} pending={isPendingForSession} />
        )}
      </div>

      {askError !== null && (
        <div className="rounded-lg border border-neg-ring bg-neg-tint px-3 py-2 text-body-sm text-neg animate-fade">
          {askError}
        </div>
      )}

      <Composer
        value={question}
        onChange={setQuestion}
        onSubmit={() => {
          handleAsk(question);
        }}
        disabled={isPendingForSession}
      />
    </div>
  );
}

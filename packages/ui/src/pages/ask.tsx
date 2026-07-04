import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { AmbientWave } from "../components/ask/ambientWave";
import { Composer } from "../components/ask/composer";
import { MessageList } from "../components/ask/messageList";
import { SuggestionGrid } from "../components/ask/suggestionGrid";
import { Breadcrumb } from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import { askAdvisor, fetchAdvisoryConversations } from "../lib/api";

type View = "hero" | "conversation";

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
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      setAskError(null);
      setQuestion("");
      void queryClient.invalidateQueries({ queryKey: ["advisor-conversations"] });
    },
    onError: (error: Error) => {
      setAskError(error.message);
    },
  });

  const sessionMessages = conversations.filter((message) => message.sessionId === sessionId);

  const handleAsk = (text: string): void => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    setAskError(null);
    setView("conversation");
    mutation.mutate(trimmed);
  };

  const handleReturnToHero = (): void => {
    setView("hero");
  };

  const handleNewChat = (): void => {
    setSessionId(crypto.randomUUID());
    setView("hero");
    setQuestion("");
    setAskError(null);
  };

  if (view === "hero") {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center">
        <AmbientWave />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div>
            <h1 className="text-display font-semibold text-fg">Ask Drishti</h1>
            <p className="mt-2 text-body text-fg-muted">
              Ask about a holding, a sector, or how your portfolio is doing today.
            </p>
          </div>
          <SuggestionGrid onSelect={handleAsk} />
        </div>
        <div className="relative z-10 w-full max-w-2xl">
          <Composer
            value={question}
            onChange={setQuestion}
            onSubmit={() => {
              handleAsk(question);
            }}
            disabled={mutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[{ label: "Ask Drishti", onClick: handleReturnToHero }, { label: "Conversation" }]}
        />
        <Button variant="ghost" onClick={handleNewChat}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <span
              role="status"
              aria-label="Loading"
              className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-gold"
            />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
            Failed to load conversation. Is the agent running?
          </div>
        ) : (
          <MessageList messages={sessionMessages} pending={mutation.isPending} />
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
        disabled={mutation.isPending}
      />
    </div>
  );
}

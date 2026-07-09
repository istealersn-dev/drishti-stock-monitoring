import { randomUUID } from "node:crypto";

import { and, desc, eq, gte } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";

import { db } from "../../db/db.js";
import { advisoryConversations } from "../../db/schema.js";
import {
  ADVISOR_LLM_TIMEOUT_MS,
  ADVISOR_MAX_TOKENS,
  ADVISOR_TEMPERATURE,
  TRADE_SETUP_MAX_TOKENS,
  chatOnce,
} from "../../llm/llmClient.js";
import { runToolLoop } from "../../llm/toolLoop.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { stripJsonCodeFence } from "../../shared/llmResponse.js";
import { logger } from "../../shared/logger.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";
import { createWebSearchExecutor } from "../websearch/webSearch.executor.js";
import { webSearchToolDefinition } from "../websearch/webSearch.toolDefinition.js";

import {
  SEBI_ADVISOR_SYSTEM_PROMPT,
  TRADE_SETUP_SYSTEM_PROMPT,
  buildAdvisoryContext,
} from "./advisor.prompts.js";
import { TradeSetupSchema } from "./advisor.schema.js";
import type { AdvisoryRequest, AdvisoryResponse, TradeSetup } from "./advisor.schema.js";

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 6000; // caps resent token volume regardless of turn count
// How long a session can go quiet before its holdings snapshot is considered stale
// enough to warrant re-injecting fresh prices, even mid-thread.
const SNAPSHOT_REFRESH_MS = 15 * 60 * 1000;

type SessionHistory = {
  messages: ChatCompletionMessageParam[];
  /** ISO timestamp of the most recent stored turn, or null if the session has no history yet. */
  lastMessageAt: string | null;
};

/**
 * Load recent conversation turns for a session as chat messages.
 * Loads at most MAX_HISTORY_TURNS rows (MAX_HISTORY_TURNS / 2 user+assistant pairs),
 * then trims from the oldest until the total character count is under
 * MAX_HISTORY_CHARS, to keep resent-token cost bounded. Never returns a history
 * starting on an "assistant" turn — an assistant reply with no preceding question is
 * useless as context — by pulling the paired user question back in past the char
 * budget if needed; only drops the assistant turn outright if there's truly no row
 * to pair it with.
 * @param sessionId - The session to load history for
 * @returns Chat messages in chronological order, plus the most recent turn's timestamp
 */
function loadHistory(sessionId: string): SessionHistory {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .select()
    .from(advisoryConversations)
    .where(
      and(
        eq(advisoryConversations.sessionId, sessionId),
        gte(advisoryConversations.createdAt, cutoff),
      ),
    )
    .orderBy(desc(advisoryConversations.createdAt))
    .limit(MAX_HISTORY_TURNS)
    .all();

  const lastMessageAt = rows[0]?.createdAt ?? null;
  const chronological = rows.reverse();

  // Walk backward from the newest turn, keeping whole turns within the char budget.
  // The newest turn is always kept even if it alone exceeds the budget.
  let totalChars = 0;
  let startIndex = chronological.length;
  for (let index = chronological.length - 1; index >= 0; index--) {
    const row = chronological[index];
    if (!row) continue;
    const nextTotal = totalChars + row.content.length;
    if (nextTotal > MAX_HISTORY_CHARS && startIndex < chronological.length) break;
    totalChars = nextTotal;
    startIndex = index;
  }

  // If the kept slice starts on an assistant turn, its paired user question is the
  // row directly before it (askAdvisor always inserts the pair atomically) — pull
  // it back in even past the char budget, since an assistant reply with no
  // preceding question is useless as context. Only drop it outright if there's
  // truly no earlier row to pair it with.
  if (chronological[startIndex]?.role === "assistant") {
    startIndex = startIndex > 0 ? startIndex - 1 : startIndex + 1;
  }

  return {
    messages: chronological.slice(startIndex).map((row) => ({
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
    })),
    lastMessageAt,
  };
}

/**
 * Persist a user/assistant turn pair under a session id. This function itself
 * never calls the LLM — callers that already have both sides of the exchange
 * (e.g. the intent classifier's clarifying question, or askAdvisor after its own
 * LLM call completes) use this so a later reply in the same thread has
 * conversational context via loadHistory instead of looking like a fresh,
 * context-free question. Never throws — this is best-effort persistence for
 * conversational continuity, called after the user-facing reply has already
 * been sent, so a write failure here must never surface as a second,
 * misleading "something went wrong" error on top of a reply that succeeded.
 * @param sessionId - The session to record the turn under
 * @param channel - Originating channel, for the conversation row
 * @param userText - The user's message
 * @param assistantText - Drishti's reply
 * @returns void
 */
export function recordConversationTurn(
  sessionId: string,
  channel: string,
  userText: string,
  assistantText: string,
): void {
  const userAt = new Date();
  // Force strict ordering even if both rows land in the same millisecond —
  // loadHistory's ORDER BY createdAt + "starts on assistant" pairing recovery
  // (see below) assumes the user row always sorts before its paired assistant
  // row, which two independent Date.now() reads don't guarantee.
  const assistantAt = new Date(userAt.getTime() + 1);

  try {
    db.transaction((tx) => {
      tx.insert(advisoryConversations)
        .values([
          {
            id: randomUUID(),
            sessionId,
            role: "user",
            content: userText,
            channel,
            createdAt: userAt.toISOString(),
          },
          {
            id: randomUUID(),
            sessionId,
            role: "assistant",
            content: assistantText,
            channel,
            createdAt: assistantAt.toISOString(),
          },
        ])
        .run();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("recordConversationTurn: failed to persist turn", { sessionId, error: message });
  }
}

/**
 * Answer a portfolio advisory question using the Drishti persona.
 * Loads the last 24h of conversation history for the session to maintain multi-turn context.
 * The full portfolio snapshot is only sent on a session's first turn (or after a
 * SNAPSHOT_REFRESH_MS quiet gap) — every other follow-up sends just the question,
 * since re-injecting the whole holdings JSON every turn was overriding the model's
 * own prior answer instead of staying anchored to the thread.
 * The question and answer are persisted as two rows (role "user" and "assistant")
 * under the same session id.
 * @param request - The advisory request (question, session id, channel)
 * @returns A Result with the advisory answer, or an Error on failure
 */
export async function askAdvisor(
  request: AdvisoryRequest,
): Promise<Result<AdvisoryResponse, Error>> {
  try {
    const holdingsResult = await fetchHoldings();
    if (!holdingsResult.ok) {
      logger.warn("askAdvisor: holdings unavailable — answering without portfolio context", {
        error: holdingsResult.error.message,
      });
    }
    const holdings = holdingsResult.ok ? holdingsResult.value : [];

    const { messages: history, lastMessageAt } = loadHistory(request.sessionId);
    // Re-injecting the full portfolio snapshot on every follow-up drowned out the
    // model's own prior answer (a fresh, large structured data dump outweighs an
    // instruction sitting back in the system prompt), so a thread about a few named
    // stocks would drift into re-analysing the whole book each turn. Follow-ups send
    // just the question and rely on loadHistory's already-correct context instead —
    // except when the session has gone quiet long enough that the last snapshot's
    // prices could plausibly be stale, in which case a refresh is worth the dilution
    // risk again.
    const sessionIsStale =
      lastMessageAt === null ||
      Date.now() - new Date(lastMessageAt).getTime() > SNAPSHOT_REFRESH_MS;
    const userContext = sessionIsStale
      ? buildAdvisoryContext(holdings, request.question)
      : request.question;
    const runId = randomUUID();

    const answer = await runToolLoop(
      [
        { role: "system", content: SEBI_ADVISOR_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userContext },
      ],
      [webSearchToolDefinition],
      {
        [webSearchToolDefinition.function.name]: createWebSearchExecutor(
          runId,
          "web_search_failed",
        ),
      },
      {
        maxTokens: ADVISOR_MAX_TOKENS,
        timeoutMs: ADVISOR_LLM_TIMEOUT_MS,
        temperature: ADVISOR_TEMPERATURE,
        reasoningEffort: "none",
      },
    );
    recordConversationTurn(request.sessionId, request.channel, request.question, answer);

    return ok({ answer, sessionId: request.sessionId });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Generate a structured trade setup for a symbol from its technical levels.
 * @param symbol - The trading symbol the setup is for
 * @param levelsJson - JSON string of the stock's technical levels
 * @returns A Result with the validated trade setup, or an Error on failure
 */
export async function generateTradeSetup(
  symbol: string,
  levelsJson: string,
): Promise<Result<TradeSetup, Error>> {
  let rawResponse: string;
  try {
    rawResponse = await chatOnce(
      TRADE_SETUP_SYSTEM_PROMPT,
      `Generate a trade setup for ${symbol}.\nTechnical levels:\n${levelsJson}`,
      { timeoutMs: ADVISOR_LLM_TIMEOUT_MS, maxTokens: TRADE_SETUP_MAX_TOKENS },
    );
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }

  const cleaned = stripJsonCodeFence(rawResponse);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return err(new Error("LLM returned non-JSON setup response: " + cleaned.slice(0, 200)));
  }

  const withSymbol = typeof parsed === "object" && parsed !== null ? { symbol, ...parsed } : parsed;
  const validated = TradeSetupSchema.safeParse(withSymbol);
  if (!validated.success) {
    return err(new Error("Trade setup failed schema validation: " + validated.error.message));
  }

  return ok(validated.data);
}

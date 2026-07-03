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
import { logger } from "../../shared/logger.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";
import { WebSearchToolArgumentsSchema } from "../websearch/webSearch.schema.js";
import { webSearchToolDefinition } from "../websearch/webSearch.toolDefinition.js";
import { searchWeb } from "../websearch/webSearch.tools.js";

import {
  SEBI_ADVISOR_SYSTEM_PROMPT,
  TRADE_SETUP_SYSTEM_PROMPT,
  buildAdvisoryContext,
} from "./advisor.prompts.js";
import { TradeSetupSchema } from "./advisor.schema.js";
import type { AdvisoryRequest, AdvisoryResponse, TradeSetup } from "./advisor.schema.js";

/**
 * Execute the web_search tool call: parse the model's raw JSON arguments, run the
 * search, and always return a string (never throw) — a malformed args payload or a
 * search failure degrades to an error message the model can see and work around,
 * rather than aborting the whole advisor reply.
 * @param argsJson - Raw JSON arguments string from the model's tool call
 * @returns The search result text, or a description of what went wrong
 */
async function executeWebSearch(argumentsJson: string): Promise<string> {
  let parsedArguments: unknown;
  try {
    parsedArguments = JSON.parse(argumentsJson);
  } catch {
    return "Invalid search arguments — could not parse.";
  }

  const arguments_ = WebSearchToolArgumentsSchema.safeParse(parsedArguments);
  if (!arguments_.success) {
    return `Invalid search arguments: ${arguments_.error.message}`;
  }

  const result = await searchWeb(arguments_.data.symbol, arguments_.data.query);
  return result.ok ? result.value : `Web search failed: ${result.error.message}`;
}

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 6000; // caps resent token volume regardless of turn count

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
 * @returns Chat messages in chronological order
 */
function loadHistory(sessionId: string): ChatCompletionMessageParam[] {
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

  return chronological.slice(startIndex).map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
  }));
}

/**
 * Answer a portfolio advisory question using the Drishti persona.
 * Loads the last 24h of conversation history for the session to maintain multi-turn context.
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

    const history = loadHistory(request.sessionId);
    const userContext = buildAdvisoryContext(holdings, request.question);

    const userAt = new Date().toISOString();
    const answer = await runToolLoop(
      [
        { role: "system", content: SEBI_ADVISOR_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userContext },
      ],
      [webSearchToolDefinition],
      { [webSearchToolDefinition.function.name]: executeWebSearch },
      {
        maxTokens: ADVISOR_MAX_TOKENS,
        timeoutMs: ADVISOR_LLM_TIMEOUT_MS,
        temperature: ADVISOR_TEMPERATURE,
      },
    );
    const assistantAt = new Date().toISOString();

    db.transaction((tx) => {
      tx.insert(advisoryConversations)
        .values({
          id: randomUUID(),
          sessionId: request.sessionId,
          role: "user",
          content: request.question,
          channel: request.channel,
          createdAt: userAt,
        })
        .run();
      tx.insert(advisoryConversations)
        .values({
          id: randomUUID(),
          sessionId: request.sessionId,
          role: "assistant",
          content: answer,
          channel: request.channel,
          createdAt: assistantAt,
        })
        .run();
    });

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

  const cleaned = rawResponse
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

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

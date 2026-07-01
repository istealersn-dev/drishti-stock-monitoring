import { randomUUID } from "node:crypto";

import type { Content } from "@google/genai";
import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "../../db/db.js";
import { advisoryConversations } from "../../db/schema.js";
import { chatWithDrishti, generateText, toGeminiHistory } from "../../llm/geminiClient.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";

import {
  SEBI_ADVISOR_SYSTEM_PROMPT,
  TRADE_SETUP_SYSTEM_PROMPT,
  buildAdvisoryContext,
} from "./advisor.prompts.js";
import { TradeSetupSchema } from "./advisor.schema.js";
import type { AdvisoryRequest, AdvisoryResponse, TradeSetup } from "./advisor.schema.js";

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 6000; // caps resent token volume regardless of turn count

// Questions matching these need live web data (news, macro events) that the
// portfolio/technicals context can't supply — grounding is only worth its
// extra cost for this subset of questions. Deliberately avoids generic single
// words ("today", "recent", "results") that show up in routine hold/trim
// questions too, since a false positive here defeats the point of gating.
const GROUNDING_SIGNAL_KEYWORDS = [
  "news",
  "recent news",
  "latest news",
  "why did",
  "why is",
  "quarterly results",
  "earnings",
  "rbi",
  "budget",
  "sebi circular",
  "ipo",
  "merger",
  "acquisition",
  "market sentiment",
  "stock split",
  "bonus issue",
];

/**
 * Decide whether a question needs Google Search grounding. Grounding adds cost/quota
 * on top of normal tokens, so it's only enabled for questions that plausibly need
 * live web data rather than portfolio/technicals reasoning. Matches on word
 * boundaries to avoid short keywords (e.g. "rbi", "ipo") false-positiving inside
 * unrelated words.
 * @param question - The user's advisory question
 * @returns true if the question should be answered with grounding enabled
 */
function needsGrounding(question: string): boolean {
  const lower = question.toLowerCase();
  return GROUNDING_SIGNAL_KEYWORDS.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}

/**
 * Load recent conversation turns for a session and convert to Gemini history format.
 * Loads at most MAX_HISTORY_TURNS pairs, then trims from the oldest until the total
 * character count is under MAX_HISTORY_CHARS, to keep resent-token cost bounded.
 * Never returns a history starting on an "assistant" turn — Gemini requires the
 * first turn to be "user", so a leading unpaired assistant reply is dropped.
 * @param sessionId - The session to load history for
 * @returns Gemini-format Content array
 */
function loadHistory(sessionId: string): Content[] {
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

  // If the kept slice starts on an assistant turn, its paired user question was
  // trimmed off above — drop the now-unpaired assistant turn too.
  while (chronological[startIndex]?.role === "assistant") {
    startIndex++;
  }

  return toGeminiHistory(chronological.slice(startIndex));
}

/**
 * Answer a portfolio advisory question using the Drishti persona (Gemini 2.5 Flash + Google Search).
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
    const answer = await chatWithDrishti(SEBI_ADVISOR_SYSTEM_PROMPT, history, userContext, {
      grounding: needsGrounding(request.question),
    });
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
 * Uses Gemini Flash (full model) for reliable JSON output.
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
    rawResponse = await generateText(
      TRADE_SETUP_SYSTEM_PROMPT,
      `Generate a trade setup for ${symbol}.\nTechnical levels:\n${levelsJson}`,
      { model: "gemini-2.5-flash" },
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

import { randomUUID } from "node:crypto";

import { db } from "../../db/db.js";
import { advisoryConversations } from "../../db/schema.js";
import { chat } from "../../llm/llmClient.js";
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

/**
 * Answer a portfolio advisory question using the SEBI advisor persona.
 * Holdings are fetched for context; a fetch failure falls back to an empty portfolio
 * rather than blocking the advisory. The question and answer are persisted as two rows
 * (role "user" and "assistant") under the same session id.
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

    const userAt = new Date().toISOString();
    const context = buildAdvisoryContext(holdings, request.question);
    const answer = await chat([
      { role: "system", content: SEBI_ADVISOR_SYSTEM_PROMPT },
      { role: "user", content: context },
    ]);
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
 * The LLM returns the setup body as JSON; the symbol is attached and the result is
 * validated against TradeSetupSchema.
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
    rawResponse = await chat([
      { role: "system", content: TRADE_SETUP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate a trade setup for ${symbol}.\nTechnical levels:\n${levelsJson}`,
      },
    ]);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return err(new Error("LLM returned non-JSON setup response: " + rawResponse.slice(0, 200)));
  }

  const withSymbol = typeof parsed === "object" && parsed !== null ? { symbol, ...parsed } : parsed;
  const validated = TradeSetupSchema.safeParse(withSymbol);
  if (!validated.success) {
    return err(new Error("Trade setup failed schema validation: " + validated.error.message));
  }

  return ok(validated.data);
}

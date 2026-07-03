import {
  INTENT_CLASSIFICATION_MAX_TOKENS,
  INTENT_CLASSIFICATION_TIMEOUT_MS,
  chatOnce,
} from "../../llm/llmClient.js";
import { logger } from "../../shared/logger.js";

import { INTENT_CLASSIFICATION_SYSTEM_PROMPT } from "./instructions.prompts.js";
import { IntentClassificationSchema } from "./instructions.schema.js";
import type { IntentClassification } from "./instructions.schema.js";

const BUY_INSTRUCTION_FALLBACK = /\bbuy\b.*\d/i;

/**
 * Fall back to a regex heuristic when the LLM classifier call fails or returns
 * something unparsable, so a real buy instruction is never silently dropped just
 * because the classifier was unavailable.
 * @param text - The raw mention text
 * @returns ORDER if the text looks like a buy instruction, otherwise QUERY
 */
function classifyByRegex(text: string): IntentClassification {
  return BUY_INSTRUCTION_FALLBACK.test(text)
    ? { intent: "ORDER", clarifyingQuestion: null }
    : { intent: "QUERY", clarifyingQuestion: null };
}

/**
 * Classify a Slack @mention as an order instruction, a conversational query, or
 * ambiguous — using a single low-temperature LM Studio call. Falls back to a
 * regex heuristic if the LLM call or response parsing fails, so this never
 * throws or reports a failure — the mention handler always gets a decision.
 * @param text - The raw mention text (mention prefix already stripped)
 * @returns The classification, from the LLM or the regex fallback
 */
export async function classifyIntent(text: string): Promise<IntentClassification> {
  try {
    const response = await chatOnce(INTENT_CLASSIFICATION_SYSTEM_PROMPT, text, {
      maxTokens: INTENT_CLASSIFICATION_MAX_TOKENS,
      timeoutMs: INTENT_CLASSIFICATION_TIMEOUT_MS,
      temperature: 0.1,
    });

    const cleaned = response.replace(/```(?:json)?\n?|\n?```/g, "").trim();

    let raw: unknown;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      logger.warn("Intent classifier returned non-JSON — falling back to regex", {
        response: cleaned.slice(0, 200),
      });
      return classifyByRegex(text);
    }

    const parsed = IntentClassificationSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("Intent classifier response failed schema validation — falling back to regex", {
        error: parsed.error.message,
      });
      return classifyByRegex(text);
    }

    return parsed.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Intent classifier call failed — falling back to regex", { error: message });
    return classifyByRegex(text);
  }
}

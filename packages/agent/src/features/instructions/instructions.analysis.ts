import { randomUUID } from "node:crypto";

import { db } from "../../db/db.js";
import { agentLogs } from "../../db/schema.js";
import {
  INSTRUCTION_ANALYSIS_MAX_TOKENS,
  INSTRUCTION_ANALYSIS_TIMEOUT_MS,
} from "../../llm/llmClient.js";
import { runToolLoop } from "../../llm/toolLoop.js";
import { env } from "../../shared/env.js";
import { LlmError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { createWebSearchExecutor } from "../websearch/webSearch.executor.js";
import { webSearchToolDefinition } from "../websearch/webSearch.toolDefinition.js";

import { formatEntry, formatStopLoss, formatTargets } from "./instructions.approval.js";
import { BUY_ANALYSIS_SYSTEM_PROMPT } from "./instructions.prompts.js";
import type { ParsedInstruction } from "./instructions.schema.js";

function describeInstruction(instruction: ParsedInstruction, resolvedSymbol: string): string {
  return `Stock: ${resolvedSymbol}\nEntry: ${formatEntry(instruction)}\nStop Loss: ${formatStopLoss(instruction)}\nTargets: ${formatTargets(instruction)}`;
}

/**
 * Run a short AI sanity check on a buy instruction, using one web_search round for
 * recent news/price action, before the Slack approval card is sent. Never throws —
 * a failure here must never block or skip the mandatory approval gate, only degrade
 * the card to showing no analysis. Failures are logged to agent_logs (LM Studio is
 * an external service) in addition to the app logger.
 * @param instruction - The parsed buy instruction
 * @param resolvedSymbol - The Upstox trading symbol
 * @returns A Result with the analysis text, or an LlmError
 */
export async function analyzeBuyInstruction(
  instruction: ParsedInstruction,
  resolvedSymbol: string,
): Promise<Result<string, LlmError>> {
  const runId = randomUUID();

  try {
    const analysis = await runToolLoop(
      [
        { role: "system", content: BUY_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: describeInstruction(instruction, resolvedSymbol) },
      ],
      [webSearchToolDefinition],
      {
        [webSearchToolDefinition.function.name]: createWebSearchExecutor(
          runId,
          "buy_analysis_web_search_failed",
        ),
      },
      {
        maxTokens: INSTRUCTION_ANALYSIS_MAX_TOKENS,
        timeoutMs: INSTRUCTION_ANALYSIS_TIMEOUT_MS,
        temperature: 0.3,
        reasoningEffort: "none",
      },
    );

    return ok(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Buy-approval analysis failed — approval card will show no analysis", {
      symbol: resolvedSymbol,
      error: message,
    });
    db.insert(agentLogs)
      .values({
        runId,
        symbol: resolvedSymbol,
        action: "buy_analysis_failed",
        reasoning: null,
        dryRun: env.DRISHTI_DRY_RUN,
        error: message,
        createdAt: new Date().toISOString(),
      })
      .run();
    return err(new LlmError(`Buy-approval analysis failed: ${message}`));
  }
}

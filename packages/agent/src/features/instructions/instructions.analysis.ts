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
import { WebSearchToolArgumentsSchema } from "../websearch/webSearch.schema.js";
import { webSearchToolDefinition } from "../websearch/webSearch.toolDefinition.js";
import { searchWeb } from "../websearch/webSearch.tools.js";

import { BUY_ANALYSIS_SYSTEM_PROMPT } from "./instructions.prompts.js";
import type { ParsedInstruction } from "./instructions.schema.js";

/**
 * Execute the web_search tool call for the buy-analysis loop: parse the model's raw
 * JSON arguments, run the search, and always return a string (never throw) — a
 * malformed args payload or a search failure degrades to an error message the model
 * can see and reason around, rather than aborting the whole analysis. A genuine
 * Tavily-side failure is logged to agent_logs so it's diagnosable.
 * @param argumentsJson - Raw JSON arguments string from the model's tool call
 * @param runId - Correlation id for the agent_logs row
 * @returns The search result text, or a description of what went wrong
 */
async function executeWebSearch(argumentsJson: string, runId: string): Promise<string> {
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
  if (!result.ok) {
    db.insert(agentLogs)
      .values({
        runId,
        symbol: arguments_.data.symbol,
        action: "buy_analysis_web_search_failed",
        reasoning: null,
        dryRun: env.DRISHTI_DRY_RUN,
        error: result.error.message,
        createdAt: new Date().toISOString(),
      })
      .run();
    return `Web search failed: ${result.error.message}`;
  }

  return result.value;
}

function describeInstruction(instruction: ParsedInstruction, resolvedSymbol: string): string {
  const entry =
    instruction.entryLow != null && instruction.entryHigh != null
      ? `${instruction.entryLow}-${instruction.entryHigh}`
      : "unspecified";
  const targets = instruction.targets
    .map((target) => `${target.price}${target.isOpenEnded ? "+" : ""}`)
    .join(", ");

  return `Stock: ${resolvedSymbol}\nEntry: ${entry}\nStop Loss: ${instruction.stopLoss ?? "unspecified"}\nTargets: ${targets || "none"}`;
}

/**
 * Run a short AI sanity check on a buy instruction, using one web_search round for
 * recent news/price action, before the Slack approval card is sent. Never throws —
 * a failure here must never block or skip the mandatory approval gate, only degrade
 * the card to showing no analysis.
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
        [webSearchToolDefinition.function.name]: (argumentsJson: string) =>
          executeWebSearch(argumentsJson, runId),
      },
      {
        maxTokens: INSTRUCTION_ANALYSIS_MAX_TOKENS,
        timeoutMs: INSTRUCTION_ANALYSIS_TIMEOUT_MS,
        temperature: 0.3,
      },
    );

    return ok(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Buy-approval analysis failed — approval card will show no analysis", {
      symbol: resolvedSymbol,
      error: message,
    });
    return err(new LlmError(`Buy-approval analysis failed: ${message}`));
  }
}

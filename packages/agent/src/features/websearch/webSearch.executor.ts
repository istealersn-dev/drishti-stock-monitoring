import { db } from "../../db/db.js";
import { agentLogs } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";

import { WebSearchToolArgumentsSchema } from "./webSearch.schema.js";
import { searchWeb } from "./webSearch.tools.js";

/**
 * Build a web_search tool executor for use with runToolLoop: parses the model's raw
 * JSON arguments, runs the search, and always returns a string (never throws) — a
 * malformed args payload or a search failure degrades to an error message the model
 * can see and reason around, rather than aborting the whole tool loop. A genuine
 * Tavily-side failure is logged to agent_logs under the given action label so it's
 * diagnosable per caller (e.g. advisor vs buy-analysis).
 * @param runId - Correlation id for the agent_logs row
 * @param failureAction - The agent_logs `action` value to use when the search itself fails
 * @returns A tool executor function taking the raw JSON arguments string
 */
export function createWebSearchExecutor(
  runId: string,
  failureAction: string,
): (argumentsJson: string) => Promise<string> {
  return async (argumentsJson: string): Promise<string> => {
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
      logger.warn("web_search tool call failed", { runId, error: result.error.message });
      db.insert(agentLogs)
        .values({
          runId,
          symbol: arguments_.data.symbol,
          action: failureAction,
          reasoning: null,
          dryRun: env.DRISHTI_DRY_RUN,
          error: result.error.message,
          createdAt: new Date().toISOString(),
        })
        .run();
      return `Web search failed: ${result.error.message}`;
    }

    return result.value;
  };
}

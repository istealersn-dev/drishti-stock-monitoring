import type { Holding, Quote } from "../../broker/brokerClient.types.js";
import { chatOnce, PORTFOLIO_MAX_TOKENS, PORTFOLIO_LLM_TIMEOUT_MS } from "../../llm/llmClient.js";
import { LlmError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { stripJsonCodeFence } from "../../shared/llmResponse.js";
import type { StockSlConfig } from "../stopLoss/stopLoss.config.js";

import { buildPortfolioPrompt, PORTFOLIO_ANALYSIS_SYSTEM_PROMPT } from "./insights.prompts.js";
import { LlmOutputSchema } from "./insights.schema.js";
import type { LlmOutput } from "./insights.schema.js";

type HoldingSnapshot = {
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  pnlPercent: number;
  slThreshold: number | null;
  targetOne: number | null;
  targetTwo: number | null;
};

/**
 * Build a compact portfolio snapshot for the LLM prompt.
 * Strips fields not needed for reasoning to stay within the 8K context cap.
 * @param holdings - Current portfolio holdings
 * @param ltpMap - Map of instrument_token → LTP
 * @param slConfigs - Active SL configurations from DB
 * @returns Array of per-holding snapshots
 */
function buildSnapshot(
  holdings: Holding[],
  ltpMap: Record<string, Quote>,
  slConfigs: StockSlConfig[],
): HoldingSnapshot[] {
  const slBySymbol = new Map(slConfigs.map((c) => [c.symbol, c]));

  return holdings.map((h) => {
    const ltp = ltpMap[h.instrumentToken]?.lastPrice ?? h.lastPrice;
    const pnlPercent = h.averagePrice > 0 ? ((ltp - h.averagePrice) / h.averagePrice) * 100 : 0;
    const config = slBySymbol.get(h.tradingSymbol);

    return {
      symbol: h.tradingSymbol,
      companyName: h.companyName,
      quantity: h.quantity,
      avgPrice: h.averagePrice,
      ltp,
      pnlPercent: Number(pnlPercent.toFixed(2)),
      slThreshold: config?.slThreshold ?? null,
      targetOne: null,
      targetTwo: null,
    };
  });
}

/**
 * Run the portfolio analysis LLM chain.
 * Builds a snapshot, sends it to LM Studio, and Zod-validates the response.
 * A "buy" action is structurally impossible — it is not in the output schema.
 * @param holdings - Current portfolio holdings
 * @param ltpMap - Map of instrument_token → LTP
 * @param slConfigs - Active SL configurations from DB
 * @returns A Result containing the validated LLM output, or an LlmError
 */
export async function analysePortfolio(
  holdings: Holding[],
  ltpMap: Record<string, Quote>,
  slConfigs: StockSlConfig[],
): Promise<Result<LlmOutput, LlmError>> {
  const snapshot = buildSnapshot(holdings, ltpMap, slConfigs);
  const userPrompt = buildPortfolioPrompt(snapshot);

  let raw: string;
  try {
    // Gated on material change (see agent.graph.ts) so each firing still stays cheap
    // despite the higher per-call cost of local inference.
    raw = await chatOnce(PORTFOLIO_ANALYSIS_SYSTEM_PROMPT, userPrompt, {
      maxTokens: PORTFOLIO_MAX_TOKENS,
      timeoutMs: PORTFOLIO_LLM_TIMEOUT_MS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new LlmError(message));
  }

  const cleaned = stripJsonCodeFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return err(new LlmError(`LLM returned non-JSON response: ${cleaned.slice(0, 200)}`));
  }

  const result = LlmOutputSchema.safeParse(parsed);
  if (!result.success) {
    return err(new LlmError(`LLM output failed schema validation: ${result.error.message}`));
  }

  return ok(result.data);
}

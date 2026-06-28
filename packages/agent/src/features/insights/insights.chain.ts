import { chat, PORTFOLIO_MAX_TOKENS } from "../../llm/llmClient.js";
import { LlmError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";
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
  ltpMap: Record<string, LtpData>,
  slConfigs: StockSlConfig[],
): HoldingSnapshot[] {
  const slBySymbol = new Map(slConfigs.map((c) => [c.symbol, c]));

  return holdings.map((h) => {
    const ltp = ltpMap[h.instrument_token]?.last_price ?? h.last_price;
    const pnlPercent = h.average_price > 0 ? ((ltp - h.average_price) / h.average_price) * 100 : 0;
    const config = slBySymbol.get(h.trading_symbol);

    return {
      symbol: h.trading_symbol,
      companyName: h.company_name,
      quantity: h.quantity,
      avgPrice: h.average_price,
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
  ltpMap: Record<string, LtpData>,
  slConfigs: StockSlConfig[],
): Promise<Result<LlmOutput, LlmError>> {
  const snapshot = buildSnapshot(holdings, ltpMap, slConfigs);
  const userPrompt = buildPortfolioPrompt(snapshot);

  let raw: string;
  try {
    raw = await chat(
      [
        { role: "system", content: PORTFOLIO_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      PORTFOLIO_MAX_TOKENS,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new LlmError(message));
  }

  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

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

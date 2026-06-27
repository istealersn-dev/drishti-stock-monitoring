import { z } from "zod";

import { env } from "../../shared/env.js";
import { UpstoxError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import type { ResolvedStock } from "./instructions.schema.js";

const BASE_URL = "https://api.upstox.com";

function readHeaders(): HeadersInit {
  const token = env.UPSTOX_EXTENDED_TOKEN || env.UPSTOX_ACCESS_TOKEN || "";
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

// NOTE: This schema should be verified against a live Upstox API response
// before deploying to production. Run with DRISHTI_DRY_RUN=true and inspect
// the raw response to confirm field names match.
const InstrumentSearchItemSchema = z.object({
  trading_symbol: z.string(),
  exchange: z.string(),
  instrument_token: z.string(),
  name: z.string().optional(),
});

const InstrumentSearchResponseSchema = z.object({
  status: z.string(),
  data: z.array(InstrumentSearchItemSchema),
});

/**
 * Resolve a human-readable stock name to an Upstox trading symbol.
 * Queries the Upstox instrument search API and returns the first NSE equity match.
 * @param stockName - Human-readable name (e.g. "Ramco Systems" or "RELIANCE")
 * @returns A Result containing the resolved stock or an UpstoxError
 */
export async function resolveSymbol(
  stockName: string,
): Promise<Result<ResolvedStock, UpstoxError>> {
  const query = encodeURIComponent(stockName.trim());
  const url = `${BASE_URL}/v2/market/instruments/search?q=${query}&instrument_type=EQ`;

  try {
    const response = await fetch(url, { headers: readHeaders() });
    if (!response.ok) {
      return err(new UpstoxError(`Symbol search failed: ${response.statusText}`, response.status));
    }

    const body: unknown = await response.json();
    const parsed = InstrumentSearchResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`Symbol search parse error: ${parsed.error.message}`));
    }

    const nseMatch = parsed.data.data.find((item) => item.exchange === "NSE");
    if (!nseMatch) {
      return err(new UpstoxError(`No NSE equity found for: ${stockName}`));
    }

    return ok({
      tradingSymbol: nseMatch.trading_symbol,
      exchange: nseMatch.exchange,
      instrumentToken: nseMatch.instrument_token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new UpstoxError(`Failed to resolve symbol: ${message}`));
  }
}

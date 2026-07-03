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

// Verified against a live Upstox API response on 2026-07-03 (GET
// /v2/instruments/search?query=RELIANCE&exchanges=NSE&segments=EQ returned
// HTTP 200 with this shape). The response has more fields than modeled here
// (isin, exchange_token, short_name, tick_size, lot_size, instrument_type,
// freeze_quantity, qty_multiplier, security_type) — only what's used downstream
// is included. Note the field is `instrument_key` (e.g. "NSE_EQ|INE002A01018"),
// not `instrument_token` as this file previously (incorrectly) assumed.
const InstrumentSearchItemSchema = z.object({
  trading_symbol: z.string(),
  exchange: z.string(),
  instrument_key: z.string(),
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
  const url = `${BASE_URL}/v2/instruments/search?query=${query}&exchanges=NSE&segments=EQ`;

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
      instrumentToken: nseMatch.instrument_key,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new UpstoxError(`Failed to resolve symbol: ${message}`));
  }
}

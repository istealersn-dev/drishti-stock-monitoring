import { env } from "../../shared/env.js";
import { UpstoxError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import {
  HoldingsResponseSchema,
  LtpResponseSchema,
  MarginResponseSchema,
} from "./portfolio.schema.js";
import type { Holding, LtpData, MarginEquity } from "./portfolio.schema.js";

const BASE_URL = "https://api.upstox.com";

function readToken(): string {
  return env.UPSTOX_EXTENDED_TOKEN || env.UPSTOX_ACCESS_TOKEN || "";
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${readToken()}`,
    Accept: "application/json",
  };
}

/**
 * Fetch all long-term holdings from Upstox.
 * Uses the extended (read-only) token when available, falls back to access token.
 * @returns A Result containing the holdings array or an UpstoxError
 */
export async function fetchHoldings(): Promise<Result<Holding[], UpstoxError>> {
  const url = `${BASE_URL}/v2/portfolio/long-term-holdings`;
  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      return err(
        new UpstoxError(`Holdings request failed: ${response.statusText}`, response.status),
      );
    }
    const body: unknown = await response.json();
    const parsed = HoldingsResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`Holdings response parse error: ${parsed.error.message}`));
    }
    return ok(parsed.data.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new UpstoxError(`Failed to fetch holdings: ${message}`));
  }
}

/**
 * Fetch last traded prices for a set of instrument keys.
 * @param instrumentKeys - Pipe-delimited instrument keys (e.g. "NSE_EQ|INE002A01018,NSE_EQ|INE009A01021")
 * @returns A Result containing a map of instrument key → LTP data or an UpstoxError
 */
export async function fetchLTP(
  instrumentKeys: string,
): Promise<Result<Record<string, LtpData>, UpstoxError>> {
  const url = `${BASE_URL}/v2/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKeys)}`;
  try {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      return err(new UpstoxError(`LTP request failed: ${response.statusText}`, response.status));
    }
    const body: unknown = await response.json();
    const parsed = LtpResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`LTP response parse error: ${parsed.error.message}`));
    }
    return ok(parsed.data.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new UpstoxError(`Failed to fetch LTP: ${message}`));
  }
}

/**
 * Fetch available equity funds and margin from Upstox.
 * Uses the access token (account-specific endpoint).
 * @returns A Result containing margin data or an UpstoxError
 */
export async function fetchMargins(): Promise<Result<MarginEquity, UpstoxError>> {
  const url = `${BASE_URL}/v2/user/get-funds-and-margin`;
  const token = env.UPSTOX_ACCESS_TOKEN || env.UPSTOX_EXTENDED_TOKEN || "";
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return err(new UpstoxError(`Margin request failed: ${response.statusText}`, response.status));
    }
    const body: unknown = await response.json();
    const parsed = MarginResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`Margin response parse error: ${parsed.error.message}`));
    }
    const equity = parsed.data.data.equity;
    if (!equity) {
      return err(new UpstoxError("No equity margin data in response"));
    }
    return ok(equity);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new UpstoxError(`Failed to fetch margins: ${message}`));
  }
}

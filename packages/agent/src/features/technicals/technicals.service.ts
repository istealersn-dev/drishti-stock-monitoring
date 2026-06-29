import { env } from "../../shared/env.js";
import { UpstoxError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import { HistoricalCandleResponseSchema, OHLCVBarSchema } from "./technicals.schema.js";
import type { OHLCVBar, TechnicalLevels } from "./technicals.schema.js";

const BASE_URL = "https://api.upstox.com";
const DMA_50_WINDOW = 50;
const DMA_200_WINDOW = 200;
const SWING_WINDOW = 20;
const VOLUME_WINDOW = 20;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Format a Date as a YYYY-MM-DD calendar date string.
 * @param date - The date to format
 * @returns The date in YYYY-MM-DD form
 */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Average a list of numbers.
 * @param values - The numbers to average
 * @returns The arithmetic mean, or null if the list is empty
 */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Fetch daily OHLCV bars for an instrument from the Upstox historical-candle API.
 * Uses the read-only extended token; no daily access token is required.
 * @param instrumentKey - The Upstox instrument key (e.g. "NSE_EQ|INE002A01018")
 * @param days - Number of calendar days of history to request, counting back from today
 * @returns A Result containing OHLCV bars sorted oldest-first, or an UpstoxError
 */
export async function fetchOHLCV(
  instrumentKey: string,
  days: number,
): Promise<Result<OHLCVBar[], UpstoxError>> {
  const token = env.UPSTOX_EXTENDED_TOKEN;
  if (!token) {
    return err(new UpstoxError("fetchOHLCV requires UPSTOX_EXTENDED_TOKEN"));
  }

  const toDate = toDateString(new Date());
  const fromDate = toDateString(new Date(Date.now() - days * MILLIS_PER_DAY));
  const url = `${BASE_URL}/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      return err(
        new UpstoxError(
          `Historical candle request failed: ${response.statusText}`,
          response.status,
        ),
      );
    }
    const body: unknown = await response.json();
    const parsed = HistoricalCandleResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(
        new UpstoxError(`Historical candle response parse error: ${parsed.error.message}`),
      );
    }

    const bars: OHLCVBar[] = [];
    for (const candle of parsed.data.data.candles) {
      const bar = OHLCVBarSchema.safeParse({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        oi: candle[6],
      });
      if (!bar.success) {
        return err(new UpstoxError(`Historical candle row parse error: ${bar.error.message}`));
      }
      bars.push(bar.data);
    }

    bars.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return ok(bars);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new UpstoxError(`Failed to fetch historical candles: ${message}`));
  }
}

/**
 * Compute technical levels (moving averages, 52-week range, swing range, average volume)
 * from a set of daily OHLCV bars sorted oldest-first.
 * @param symbol - The trading symbol the levels belong to
 * @param bars - Daily OHLCV bars sorted oldest-first
 * @returns The derived technical levels; individual fields are null when there is insufficient data
 */
export function computeLevels(symbol: string, bars: OHLCVBar[]): TechnicalLevels {
  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume);

  const dma50 = bars.length >= DMA_50_WINDOW ? average(closes.slice(-DMA_50_WINDOW)) : null;
  const dma200 = bars.length >= DMA_200_WINDOW ? average(closes.slice(-DMA_200_WINDOW)) : null;
  const weekHigh52 = highs.length > 0 ? Math.max(...highs) : null;
  const weekLow52 = lows.length > 0 ? Math.min(...lows) : null;
  const swingHighs = highs.slice(-SWING_WINDOW);
  const swingLows = lows.slice(-SWING_WINDOW);
  const swingHigh = swingHighs.length > 0 ? Math.max(...swingHighs) : null;
  const swingLow = swingLows.length > 0 ? Math.min(...swingLows) : null;
  const avgVolume20 = average(volumes.slice(-VOLUME_WINDOW));

  return {
    symbol,
    date: toDateString(new Date()),
    dma50,
    dma200,
    weekHigh52,
    weekLow52,
    swingHigh,
    swingLow,
    avgVolume20,
    updatedAt: new Date().toISOString(),
  };
}

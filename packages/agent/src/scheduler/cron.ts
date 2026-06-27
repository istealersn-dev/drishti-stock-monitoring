import cron from "node-cron";

import { env } from "../shared/env.js";
import { logger } from "../shared/logger.js";

type MarketBoundary = { hours: number; minutes: number };

function parseMarketTime(hhmm: string): MarketBoundary {
  const parts = hhmm.split(":");
  return { hours: Number(parts[0]), minutes: Number(parts[1]) };
}

/**
 * Check whether the current time (or a provided date) falls within market hours.
 * @param now - Date to check against; defaults to the current time
 * @returns true if market is open
 */
export function isMarketOpen(now: Date = new Date()): boolean {
  const open = parseMarketTime(env.DRISHTI_MARKET_OPEN);
  const close = parseMarketTime(env.DRISHTI_MARKET_CLOSE);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = open.hours * 60 + open.minutes;
  const closeMinutes = close.hours * 60 + close.minutes;

  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

/**
 * Start the market-hours polling cron job.
 * The tick callback is invoked only when the market is open.
 * @param tick - Async function to run on each poll
 */
export function startCron(tick: () => Promise<void>): void {
  const expression = `*/${env.DRISHTI_POLL_INTERVAL_MINUTES} * * * *`;

  cron.schedule(expression, () => {
    if (!isMarketOpen()) {
      logger.debug("Market closed — skipping poll tick");
      return;
    }

    tick().catch((error: unknown) => {
      logger.error("Cron tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  logger.info("Cron scheduler started", {
    expression,
    marketOpen: env.DRISHTI_MARKET_OPEN,
    marketClose: env.DRISHTI_MARKET_CLOSE,
  });
}

import cron from "node-cron";

import { pushAlert } from "../features/alerts/alerts.slack.js";
import { setLastHealthReport } from "../features/health/health.cache.js";
import { computeHealthReport } from "../features/health/health.engine.js";
import { formatHealthReport } from "../features/health/health.formatter.js";
import { resolveSymbol } from "../features/instructions/instructions.resolver.js";
import { getCachedHoldings } from "../features/portfolio/portfolio.cache.js";
import { getCachedLevels, refreshLevels } from "../features/technicals/technicals.cache.js";
import { checkProximity } from "../features/watchlist/watchlist.monitor.js";
import { getWatchlist } from "../features/watchlist/watchlist.service.js";
import { env } from "../shared/env.js";
import { logger } from "../shared/logger.js";
import { createSingleFlightGuard } from "../shared/singleFlight.js";

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
  const guard = createSingleFlightGuard();

  cron.schedule(expression, () => {
    if (!isMarketOpen()) {
      logger.debug("Market closed — skipping poll tick");
      return;
    }

    guard
      .tryRun(tick)
      .then((started) => {
        if (!started) {
          logger.warn("Skipping poll tick — previous tick still in progress");
        }
      })
      .catch((error: unknown) => {
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

/**
 * Start Phase 7 advisor cron jobs:
 * - Daily at 16:00 IST (weekdays): refresh technical levels for all active holdings + watchlist
 * - Every Sunday at 10:00 IST: compute portfolio health report and post to Slack
 */
export function startAdvisorCrons(): void {
  // Daily technical levels refresh — runs at 16:00 on Mon–Fri (after market close)
  cron.schedule("0 16 * * 1-5", () => {
    void (async (): Promise<void> => {
      logger.info("Starting daily technical levels refresh");
      try {
        const { holdings } = getCachedHoldings();
        const watchlistEntries = getWatchlist();

        const allSymbols = [
          ...new Set([
            ...holdings.map((h) => h.trading_symbol),
            ...watchlistEntries.map((w) => w.symbol),
          ]),
        ];

        const instrumentKeyMap: Record<string, string> = {};
        for (const h of holdings) {
          instrumentKeyMap[h.trading_symbol] = h.instrument_token;
        }
        // Resolve instrument tokens for watchlist-only symbols (not in holdings)
        const watchlistOnly = watchlistEntries
          .map((w) => w.symbol)
          .filter((s) => !(s in instrumentKeyMap));
        await Promise.allSettled(
          watchlistOnly.map(async (symbol) => {
            const result = await resolveSymbol(symbol);
            if (result.ok) {
              instrumentKeyMap[symbol] = result.value.instrumentToken;
            } else {
              logger.warn("Could not resolve instrument token for watchlist symbol", { symbol });
            }
          }),
        );

        await refreshLevels(allSymbols, instrumentKeyMap);
        logger.info("Technical levels refresh complete", { count: allSymbols.length });
      } catch (error) {
        logger.error("Technical levels refresh failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });

  // Weekly health report — runs every Sunday at 10:00
  cron.schedule("0 10 * * 0", () => {
    void (async (): Promise<void> => {
      logger.info("Starting weekly portfolio health report");
      try {
        const result = await computeHealthReport();
        if (!result.ok) {
          logger.error("Health report failed", { error: result.error.message });
          await pushAlert(`⚠️ *Weekly health report failed:* ${result.error.message}`);
          return;
        }
        setLastHealthReport(result.value);
        await pushAlert(formatHealthReport(result.value));
        logger.info("Weekly health report posted to Slack");
      } catch (error) {
        logger.error("Health report cron threw", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });

  logger.info("Advisor crons started (technicals @16:00 weekdays, health @10:00 Sundays)");
}

/**
 * Fetch proximity alerts for all watchlist stocks using cached technical levels.
 * Used by the morning digest to flag watchlist stocks near DMA200 support.
 * @returns Array of human-readable proximity alert strings
 */
export async function getWatchlistProximityAlerts(): Promise<string[]> {
  try {
    const entries = getWatchlist();
    if (entries.length === 0) return [];

    const levelsBySymbol: Record<string, { dma200: number | null }> = {};
    const instrumentKeyMap: Record<string, string> = {};
    const { holdings } = getCachedHoldings();
    for (const h of holdings) {
      instrumentKeyMap[h.trading_symbol] = h.instrument_token;
    }
    for (const entry of entries) {
      const cached = getCachedLevels(entry.symbol);
      levelsBySymbol[entry.symbol] = { dma200: cached?.dma200 ?? null };
    }
    const unresolved = entries.filter((entry) => !instrumentKeyMap[entry.symbol]);
    await Promise.allSettled(
      unresolved.map(async (entry) => {
        const resolved = await resolveSymbol(entry.symbol);
        if (resolved.ok) instrumentKeyMap[entry.symbol] = resolved.value.instrumentToken;
      }),
    );

    const alerts = await checkProximity(entries, levelsBySymbol, instrumentKeyMap);
    return alerts.map(
      (a) =>
        `${a.displayName} is ${a.distancePct.toFixed(1)}% from 200 DMA (LTP ₹${a.ltp.toFixed(0)}, DMA ₹${a.dma200.toFixed(0)})`,
    );
  } catch (error) {
    logger.error("Watchlist proximity check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

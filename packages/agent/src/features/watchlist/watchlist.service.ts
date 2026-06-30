import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { watchlist } from "../../db/schema.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import type { WatchlistEntry } from "./watchlist.schema.js";

/**
 * Add a stock to the watchlist.
 * @param symbol - The instrument symbol (primary key)
 * @param displayName - Human-readable name shown in alerts
 * @param notes - Optional free-text note
 * @returns A Result that is ok on insert, or err with a helpful message on duplicate/DB failure
 */
export function addToWatchlist(
  symbol: string,
  displayName: string,
  notes?: string,
): Result<void, Error> {
  try {
    db.insert(watchlist)
      .values({
        symbol,
        displayName,
        notes: notes ?? null,
        addedAt: new Date().toISOString(),
      })
      .run();
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("UNIQUE") || message.includes("PRIMARY")) {
      return err(new Error(`${symbol} is already in watchlist`));
    }
    return err(new Error(`Failed to add ${symbol} to watchlist: ${message}`));
  }
}

/**
 * Remove a stock from the watchlist by symbol.
 * @param symbol - The instrument symbol to remove
 * @returns A Result that is ok on delete, or err on DB failure
 */
export function removeFromWatchlist(symbol: string): Result<void, Error> {
  try {
    db.delete(watchlist).where(eq(watchlist.symbol, symbol)).run();
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new Error(`Failed to remove ${symbol} from watchlist: ${message}`));
  }
}

/**
 * Read all watchlist entries.
 * @returns An array of watchlist entries (empty when none exist)
 */
export function getWatchlist(): WatchlistEntry[] {
  return db.select().from(watchlist).all();
}

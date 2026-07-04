import { eq } from "drizzle-orm";

import { db } from "../db/db.js";
import { agentSettings } from "../db/schema.js";

import { env } from "./env.js";

/**
 * Returns whether dry-run mode is currently active. The DB-backed `dry_run`
 * agent_settings row (set via the Settings UI) overrides env.DRISHTI_DRY_RUN
 * when present; otherwise falls back to the env value set at process boot.
 * Every Upstox-write call site must gate on this, not on env.DRISHTI_DRY_RUN
 * directly, so the Settings toggle actually controls order placement.
 *
 * Deliberately does not catch DB errors here: a caller using cancelGTT/createGTT
 * treats any boolean this returns as a trustworthy snapshot (e.g. "dry_run=true
 * means it's safe to mark a GTT row cancelled without a real Upstox call"). Failing
 * closed to `true` on a DB error would look exactly like a legitimate dry-run
 * result to that caller, and for a cancel that's worse than doing nothing — the
 * local DB would record "cancelled" while the real GTT stays live on Upstox. Let
 * the exception propagate so the whole operation aborts instead.
 * @returns true if dry-run mode is active
 */
export function isDryRunActive(): boolean {
  const row = db.select().from(agentSettings).where(eq(agentSettings.key, "dry_run")).get();
  if (row?.value === "true") return true;
  if (row?.value === "false") return false;
  return env.DRISHTI_DRY_RUN;
}

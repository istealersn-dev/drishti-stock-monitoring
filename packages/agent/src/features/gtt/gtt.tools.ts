import { env } from "../../shared/env.js";
import { UpstoxError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

import {
  GttCancelResponseSchema,
  GttCreateResponseSchema,
  GttListResponseSchema,
} from "./gtt.schema.js";
import type { GttCreateRequest, GttOrder } from "./gtt.schema.js";

const BASE_URL = "https://api.upstox.com";

function writeHeaders(): HeadersInit {
  const token = env.UPSTOX_ACCESS_TOKEN ?? "";
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/**
 * Create a GTT order on Upstox. Skipped entirely when dryRun is true.
 * @param request - GTT order parameters
 * @param dryRun - Caller-supplied dry-run snapshot (see shared/dryRun.ts's isDryRunActive).
 *   Taking this as a parameter rather than checking isDryRunActive() internally means a
 *   caller that also labels a DB row's status/audit fields for this same operation reads
 *   one consistent value instead of two independent DB reads that could disagree if the
 *   dry_run setting changes mid-request.
 * @returns A Result containing the Upstox order_id, or a dry-run log string, or an UpstoxError
 */
export async function createGTT(
  request: GttCreateRequest,
  dryRun: boolean,
): Promise<Result<string, UpstoxError>> {
  if (dryRun) {
    const summary = `${request.transaction_type} ${request.quantity}x ${request.trading_symbol} trigger=₹${request.trigger_price} limit=₹${request.limit_price}`;
    return ok(`[DRY_RUN] would create GTT: ${summary}`);
  }

  const url = `${BASE_URL}/v2/gtt/orders`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return err(new UpstoxError(`GTT create failed: ${response.statusText}`, response.status));
    }
    const body: unknown = await response.json();
    const parsed = GttCreateResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`GTT create parse error: ${parsed.error.message}`));
    }
    return ok(parsed.data.data.order_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new UpstoxError(`Failed to create GTT: ${message}`));
  }
}

/**
 * List all active GTT orders from Upstox.
 * @returns A Result containing the list of GTT orders or an UpstoxError
 */
export async function listGTTs(): Promise<Result<GttOrder[], UpstoxError>> {
  const url = `${BASE_URL}/v2/gtt/orders`;
  try {
    const response = await fetch(url, { headers: writeHeaders() });
    if (!response.ok) {
      return err(new UpstoxError(`GTT list failed: ${response.statusText}`, response.status));
    }
    const body: unknown = await response.json();
    const parsed = GttListResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`GTT list parse error: ${parsed.error.message}`));
    }
    return ok(parsed.data.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new UpstoxError(`Failed to list GTTs: ${message}`));
  }
}

/**
 * Cancel a GTT order on Upstox. Skipped entirely when dryRun is true.
 * @param orderId - The Upstox GTT order ID to cancel
 * @param dryRun - Caller-supplied dry-run snapshot; see createGTT's @param dryRun for why
 *   this isn't checked internally via isDryRunActive().
 * @returns A Result containing the cancelled order_id, or a dry-run log string, or an UpstoxError
 */
export async function cancelGTT(
  orderId: string,
  dryRun: boolean,
): Promise<Result<string, UpstoxError>> {
  if (dryRun) {
    return ok(`[DRY_RUN] would cancel GTT: ${orderId}`);
  }

  const url = `${BASE_URL}/v2/gtt/orders/${orderId}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: writeHeaders(),
    });
    if (!response.ok) {
      return err(new UpstoxError(`GTT cancel failed: ${response.statusText}`, response.status));
    }
    const body: unknown = await response.json();
    const parsed = GttCancelResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new UpstoxError(`GTT cancel parse error: ${parsed.error.message}`));
    }
    return ok(parsed.data.data.order_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new UpstoxError(`Failed to cancel GTT: ${message}`));
  }
}

import { z } from "zod";

const API_BASE = `http://localhost:${String(import.meta.env["VITE_API_PORT"] ?? "4000")}`;

async function apiFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as Record<string, unknown>)["error"] === "string"
      ) {
        detail = `: ${String((body as Record<string, unknown>)["error"])}`;
      }
    } catch {
      // non-JSON body (e.g. nginx 502 HTML) — detail stays empty
    }
    throw new Error(`HTTP ${String(response.status)}${detail}`);
  }
  const json: unknown = await response.json();
  return schema.parse(json);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const AgentRunSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  status: z.string(),
  summary: z.string().nullable(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const HoldingSchema = z.object({
  isin: z.string(),
  trading_symbol: z.string(),
  company_name: z.string(),
  quantity: z.number(),
  average_price: z.number(),
  last_price: z.number(),
  close_price: z.number(),
  pnl: z.number(),
  day_change: z.number(),
  day_change_percentage: z.number(),
  product: z.string(),
  exchange: z.string(),
  instrument_token: z.string(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const GttOrderSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  type: z.string(),
  triggerPrice: z.number(),
  limitPrice: z.number(),
  quantity: z.number(),
  status: z.string(),
  approvalId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GttOrder = z.infer<typeof GttOrderSchema>;

export const AgentLogSchema = z.object({
  id: z.number(),
  runId: z.string(),
  symbol: z.string().nullable(),
  action: z.string(),
  reasoning: z.string().nullable(),
  dryRun: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentLog = z.infer<typeof AgentLogSchema>;

export const SettingsSchema = z.object({
  dryRun: z.boolean(),
  pauseAgent: z.boolean(),
  pollIntervalMinutes: z.number(),
  marketOpen: z.string(),
  marketClose: z.string(),
  approvalTimeoutMinutes: z.number(),
  apiPort: z.number(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ParsedTargetSchema = z.object({
  price: z.number().positive(),
  isOpenEnded: z.boolean(),
});

export const ParsedInstructionSchema = z.object({
  stockName: z.string().min(1),
  action: z.literal("BUY"),
  entryLow: z.number().positive().nullable(),
  entryHigh: z.number().positive().nullable(),
  stopLoss: z.number().positive().nullable(),
  targets: z.array(ParsedTargetSchema),
});
export type ParsedInstruction = z.infer<typeof ParsedInstructionSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  parsedJson: z.string(),
  suggestedQty: z.number(),
  status: z.string(),
  slackTs: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  parsedInstruction: ParsedInstructionSchema.nullable(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

// ── Fetch functions ──────────────────────────────────────────────────────────

const RunsResponseSchema = z.object({ ok: z.boolean(), data: z.array(AgentRunSchema) });
const HoldingsResponseSchema = z.object({
  ok: z.boolean(),
  data: z.array(HoldingSchema),
  cachedAt: z.string().nullable(),
});
const GttResponseSchema = z.object({ ok: z.boolean(), data: z.array(GttOrderSchema) });
const LogsResponseSchema = z.object({ ok: z.boolean(), data: z.array(AgentLogSchema) });
const SettingsResponseSchema = z.object({ ok: z.boolean(), data: SettingsSchema });
const ApprovalsResponseSchema = z.object({ ok: z.boolean(), data: z.array(ApprovalSchema) });

/**
 * Fetch the 20 most recent agent runs.
 * @returns Array of agent run records
 */
export async function fetchRuns(): Promise<AgentRun[]> {
  const response = await apiFetch("/api/runs", RunsResponseSchema);
  return response.data;
}

/**
 * Fetch cached portfolio holdings.
 * @returns Holdings array and cache timestamp
 */
export async function fetchHoldings(): Promise<{ holdings: Holding[]; cachedAt: string | null }> {
  const response = await apiFetch("/api/holdings", HoldingsResponseSchema);
  return { holdings: response.data, cachedAt: response.cachedAt };
}

/**
 * Fetch GTT orders, optionally filtered by status.
 * @param status - Optional status filter
 * @returns Array of GTT orders
 */
export async function fetchGttOrders(status?: string): Promise<GttOrder[]> {
  const path = status ? `/api/gtt?status=${encodeURIComponent(status)}` : "/api/gtt";
  const response = await apiFetch(path, GttResponseSchema);
  return response.data;
}

/**
 * Fetch agent logs, optionally filtered by runId.
 * @param runId - Optional run ID filter
 * @returns Array of agent log entries
 */
export async function fetchLogs(runId?: string): Promise<AgentLog[]> {
  const path = runId ? `/api/logs?runId=${encodeURIComponent(runId)}` : "/api/logs";
  const response = await apiFetch(path, LogsResponseSchema);
  return response.data;
}

/**
 * Fetch current agent settings.
 * @returns Settings object
 */
export async function fetchSettings(): Promise<Settings> {
  const response = await apiFetch("/api/settings", SettingsResponseSchema);
  return response.data;
}

/**
 * Fetch pending approval requests.
 * @returns Array of pending approvals
 */
export async function fetchApprovals(): Promise<Approval[]> {
  const response = await apiFetch("/api/approvals", ApprovalsResponseSchema);
  return response.data;
}

/**
 * Update agent settings.
 * @param patch - Partial settings to update
 * @returns Resolves on success, throws on HTTP error
 */
export async function updateSettings(
  patch: Partial<Record<"dry_run" | "pause_agent" | "poll_interval_minutes", string>>,
): Promise<void> {
  await apiFetch("/api/settings", z.object({ ok: z.boolean(), updated: z.array(z.string()) }), {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

/**
 * Submit a buy instruction from the UI.
 * @param text - Canonical instruction text
 * @returns Approval ID and resolved symbol on success
 */
export async function submitInstruction(
  text: string,
): Promise<{ approvalId: string; symbol: string }> {
  const schema = z.object({ ok: z.boolean(), approvalId: z.string(), symbol: z.string() });
  return apiFetch("/api/instructions", schema, { method: "POST", body: JSON.stringify({ text }) });
}

/**
 * Approve a pending buy instruction.
 * @param id - Approval ID
 * @returns Resolves on success, throws on HTTP error
 */
export async function approveInstruction(id: string): Promise<void> {
  await apiFetch(
    `/api/approvals/${encodeURIComponent(id)}/approve`,
    z.object({ ok: z.boolean() }),
    { method: "POST" },
  );
}

/**
 * Reject a pending buy instruction.
 * @param id - Approval ID
 * @returns Resolves on success, throws on HTTP error
 */
export async function rejectInstruction(id: string): Promise<void> {
  await apiFetch(`/api/approvals/${encodeURIComponent(id)}/reject`, z.object({ ok: z.boolean() }), {
    method: "POST",
  });
}

/**
 * Cancel an active GTT order.
 * @param id - GTT order ID
 * @returns Resolves on success, throws on HTTP error
 */
export async function cancelGttOrder(id: string): Promise<void> {
  await apiFetch(`/api/gtt/${encodeURIComponent(id)}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  });
}

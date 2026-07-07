import { z } from "zod";

import { clearKey, getStoredKey } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function apiFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const key = getStoredKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-Access-Key"] = key;

  const response = await fetch(`${API_BASE}${path}`, { headers, ...init });

  if (response.status === 401) {
    clearKey();
    window.location.replace("/login");
    throw new Error("Session expired");
  }

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

/**
 * Validate an access key against the server.
 * @param key - The access key to validate
 * @returns Resolves on success, throws on invalid key
 */
export async function loginWithKey(key: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (response.status === 401) {
    throw new Error("Invalid access key");
  }
  if (!response.ok) {
    throw new Error(`Cannot reach Drishti API (${response.status})`);
  }
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
  dryRun: z.boolean(),
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
 * Update SL threshold and targets for a holding in stock_config.
 * Pass null for targetOne/targetTwo to clear a previously set value.
 * Creates the row if it does not yet exist.
 * @param symbol - Upstox trading symbol
 * @param patch - SL threshold (required) and targets (null = clear, number = set)
 * @returns Resolves on success, throws on HTTP error
 */
export async function updateHoldingConfig(
  symbol: string,
  patch: { slThreshold: number; targetOne: number | null; targetTwo: number | null },
): Promise<void> {
  await apiFetch(
    `/api/holdings/${encodeURIComponent(symbol)}/config`,
    z.object({ ok: z.boolean() }),
    { method: "PUT", body: JSON.stringify(patch) },
  );
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

// ── Phase 7: Health ───────────────────────────────────────────────────────

export const UnderperformerSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  buyPrice: z.number(),
  currentLtp: z.number(),
  pctDown: z.number(),
});
export type Underperformer = z.infer<typeof UnderperformerSchema>;

export const PortfolioHealthReportSchema = z.object({
  generatedAt: z.string(),
  totalPortfolioValue: z.number(),
  totalCapitalAtRisk: z.number(),
  capitalAtRiskPct: z.number(),
  mtfBurnRateMonthly: z.number(),
  activePositionCount: z.number(),
  underperformers: z.array(UnderperformerSchema),
  overdueForReview: z.array(z.string()),
  llmNarrative: z.string(),
});
export type PortfolioHealthReport = z.infer<typeof PortfolioHealthReportSchema>;

const HealthResponseSchema = z.object({ ok: z.boolean(), data: PortfolioHealthReportSchema });

/**
 * Fetch the current portfolio health report.
 * @returns Portfolio health report with risk metrics, underperformers, and LLM narrative
 */
export async function fetchHealth(): Promise<PortfolioHealthReport> {
  const response = await apiFetch("/api/health", HealthResponseSchema);
  return response.data;
}

// ── Phase 7: Watchlist ────────────────────────────────────────────────────

export const WatchlistEntrySchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  notes: z.string().nullable(),
  addedAt: z.string(),
});
export type WatchlistEntry = z.infer<typeof WatchlistEntrySchema>;

export const ProximityAlertSchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  ltp: z.number(),
  dma200: z.number(),
  distancePct: z.number(),
});
export type ProximityAlert = z.infer<typeof ProximityAlertSchema>;

const WatchlistResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    entries: z.array(WatchlistEntrySchema),
    proximityAlerts: z.array(ProximityAlertSchema),
  }),
});

/**
 * Fetch watchlist entries together with current 200-DMA proximity alerts.
 * @returns Watchlist entries and proximity alerts
 */
export async function fetchWatchlist(): Promise<{
  entries: WatchlistEntry[];
  proximityAlerts: ProximityAlert[];
}> {
  const response = await apiFetch("/api/watchlist", WatchlistResponseSchema);
  return response.data;
}

/**
 * Add a stock to the watchlist.
 * @param entry - Symbol, display name, and optional notes
 * @returns Resolves on success, throws on HTTP error
 */
export async function addWatchlistEntry(entry: {
  symbol: string;
  displayName: string;
  notes: string | null;
}): Promise<void> {
  await apiFetch("/api/watchlist", z.object({ ok: z.boolean() }), {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

/**
 * Remove a stock from the watchlist.
 * @param symbol - Upstox trading symbol to remove
 * @returns Resolves on success, throws on HTTP error
 */
export async function removeWatchlistEntry(symbol: string): Promise<void> {
  await apiFetch(`/api/watchlist/${encodeURIComponent(symbol)}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  });
}

// ── Phase 7: Advisor ──────────────────────────────────────────────────────

export const AdvisoryResponseSchema = z.object({
  answer: z.string(),
  sessionId: z.string(),
});
export type AdvisoryResponse = z.infer<typeof AdvisoryResponseSchema>;

/**
 * Ask the SEBI advisory chain a portfolio question.
 * @param question - The user's question in natural language
 * @param sessionId - Stable client-generated session id for multi-turn context
 * @returns The advisory answer and echoed session id
 */
export async function askAdvisor(question: string, sessionId: string): Promise<AdvisoryResponse> {
  return apiFetch("/api/advisor/ask", AdvisoryResponseSchema.and(z.object({ ok: z.boolean() })), {
    method: "POST",
    body: JSON.stringify({ question, sessionId, channel: "ui" }),
  });
}

export const AdvisoryConversationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  channel: z.string(),
  createdAt: z.string(),
});
export type AdvisoryConversation = z.infer<typeof AdvisoryConversationSchema>;

const AdvisoryConversationsResponseSchema = z.object({
  ok: z.boolean(),
  data: z.array(AdvisoryConversationSchema),
});

/**
 * Fetch the advisory conversation history.
 * @returns Array of advisory conversation messages, oldest first
 */
export async function fetchAdvisoryConversations(): Promise<AdvisoryConversation[]> {
  const response = await apiFetch(
    "/api/advisor/conversations",
    AdvisoryConversationsResponseSchema,
  );
  return response.data;
}

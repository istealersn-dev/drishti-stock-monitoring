import crypto from "node:crypto";

import cors from "@fastify/cors";
import { desc, eq } from "drizzle-orm";
import Fastify from "fastify";
import { z } from "zod";

import { db } from "../db/db.js";
import {
  advisoryConversations,
  agentLogs,
  agentRuns,
  agentSettings,
  gttOrders,
  pendingApprovals,
  stockConfig,
} from "../db/schema.js";
import { askAdvisor, generateTradeSetup } from "../features/advisor/advisor.chain.js";
import { getApproval, resolveApproval } from "../features/approval/approval.store.js";
import { getLastHealthReport, setLastHealthReport } from "../features/health/health.cache.js";
import { computeHealthReport } from "../features/health/health.engine.js";
import { updateApprovalCard } from "../features/instructions/instructions.approval.js";
import { executeApprovedInstruction } from "../features/instructions/instructions.executor.js";
import { submitBuyInstruction } from "../features/instructions/instructions.pipeline.js";
import { resolveSymbol } from "../features/instructions/instructions.resolver.js";
import { ParsedInstructionSchema } from "../features/instructions/instructions.schema.js";
import { getCachedHoldings } from "../features/portfolio/portfolio.cache.js";
import { getCachedLevels, saveLevels } from "../features/technicals/technicals.cache.js";
import { computeLevels, fetchOHLCV } from "../features/technicals/technicals.service.js";
import { checkProximity } from "../features/watchlist/watchlist.monitor.js";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "../features/watchlist/watchlist.service.js";
import { isDryRunActive } from "../shared/dryRun.js";
import { env } from "../shared/env.js";
import { logger } from "../shared/logger.js";

const API_RUNS_LIMIT = 20;
const API_LOGS_LIMIT = 100;

// ── Query helpers (exported for unit tests) ───────────────────────────────────

/**
 * Query the most recent agent runs.
 * @returns Last 20 agent runs ordered by startedAt desc
 */
export function queryRuns(): unknown[] {
  return db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(API_RUNS_LIMIT).all();
}

/**
 * Query GTT orders, optionally filtered by status.
 * @param status - Optional status filter (e.g. "active")
 * @returns GTT order rows
 */
export function queryGttOrders(status?: string): unknown[] {
  if (status) {
    return db.select().from(gttOrders).where(eq(gttOrders.status, status)).all();
  }
  return db.select().from(gttOrders).orderBy(desc(gttOrders.createdAt)).all();
}

/**
 * Query agent logs, optionally filtered by runId.
 * @param runId - Optional run ID filter
 * @returns Agent log rows (max 100)
 */
export function queryLogs(runId?: string): unknown[] {
  if (runId) {
    return db
      .select()
      .from(agentLogs)
      .where(eq(agentLogs.runId, runId))
      .orderBy(desc(agentLogs.id))
      .limit(API_LOGS_LIMIT)
      .all();
  }
  return db.select().from(agentLogs).orderBy(desc(agentLogs.id)).limit(API_LOGS_LIMIT).all();
}

/**
 * Query current agent settings from DB, falling back to env defaults.
 * @returns Key-value settings object
 */
export function querySettings(): Record<string, string | number | boolean> {
  const rows = db.select().from(agentSettings).all();
  const overrides = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    dryRun: isDryRunActive(),
    pauseAgent: overrides["pause_agent"] === "true",
    pollIntervalMinutes:
      overrides["poll_interval_minutes"] !== undefined
        ? Number(overrides["poll_interval_minutes"])
        : env.DRISHTI_POLL_INTERVAL_MINUTES,
    marketOpen: env.DRISHTI_MARKET_OPEN,
    marketClose: env.DRISHTI_MARKET_CLOSE,
    approvalTimeoutMinutes: env.DRISHTI_APPROVAL_TIMEOUT_MINUTES,
    apiPort: env.AGENT_API_PORT,
  };
}

/**
 * Query pending approvals, parsing the stored instruction JSON into a structured object.
 * @returns Pending approval rows with parsed instruction data
 */
export function queryApprovals(): unknown[] {
  const rows = db
    .select()
    .from(pendingApprovals)
    .where(eq(pendingApprovals.status, "pending"))
    .orderBy(desc(pendingApprovals.createdAt))
    .all();

  return rows.map((row) => {
    let parsedInstruction: unknown = null;
    try {
      const raw: unknown = JSON.parse(row.parsedJson);
      const responseult = ParsedInstructionSchema.safeParse(raw);
      parsedInstruction = responseult.success ? responseult.data : null;
    } catch {
      parsedInstruction = null;
    }
    return { ...row, parsedInstruction };
  });
}

// ── Fastify app ───────────────────────────────────────────────────────────────

const HoldingConfigBodySchema = z.object({
  slThreshold: z.number().positive(),
  targetOne: z.number().positive().nullable(),
  targetTwo: z.number().positive().nullable(),
});

const SettingsBodySchema = z
  .object({
    dry_run: z.boolean(),
    pause_agent: z.boolean(),
    poll_interval_minutes: z.number(),
  })
  .partial();

/**
 * Build and return the configured Fastify app (without starting the server).
 * Separated from startApiServer for testability.
 * @returns Configured Fastify application
 */
export async function buildApiApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Access-Key"],
  });

  // Auth hook: all /api/* except /api/auth/login requires X-Access-Key
  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/api/auth/login") return;
    const key = request.headers["x-access-key"];
    if (key !== env.DRISHTI_ACCESS_KEY) {
      return reply.status(401).send({ ok: false, error: "Unauthorized" });
    }
  });

  // ── Public ─────────────────────────────────────────────────────────────────

  app.post<{ Body: Record<string, unknown> }>("/api/auth/login", async (request, reply) => {
    const key = typeof request.body["key"] === "string" ? request.body["key"] : "";
    if (key !== env.DRISHTI_ACCESS_KEY) {
      return reply.status(401).send({ ok: false, error: "Invalid access key" });
    }
    return reply.send({ ok: true });
  });

  // ── Protected ──────────────────────────────────────────────────────────────

  app.get("/api/runs", async (_request, reply) => {
    return reply.send({ ok: true, data: queryRuns() });
  });

  app.get("/api/holdings", async (_request, reply) => {
    const { holdings, cachedAt } = getCachedHoldings();
    return reply.send({ ok: true, data: holdings, cachedAt });
  });

  app.get<{ Querystring: { status?: string } }>("/api/gtt", async (request, reply) => {
    return reply.send({ ok: true, data: queryGttOrders(request.query.status) });
  });

  app.get<{ Querystring: { runId?: string } }>("/api/logs", async (request, reply) => {
    return reply.send({ ok: true, data: queryLogs(request.query.runId) });
  });

  app.get("/api/settings", async (_request, reply) => {
    return reply.send({ ok: true, data: querySettings() });
  });

  app.put<{ Body: Record<string, unknown> }>("/api/settings", async (request, reply) => {
    const parsed = SettingsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.message });
    }

    const now = new Date().toISOString();
    const updated: string[] = [];
    for (const [key, value] of Object.entries(parsed.data)) {
      const stringValue = String(value);
      db.insert(agentSettings)
        .values({ key, value: stringValue, updatedAt: now })
        .onConflictDoUpdate({
          target: agentSettings.key,
          set: { value: stringValue, updatedAt: now },
        })
        .run();
      updated.push(key);
    }

    return reply.send({ ok: true, updated });
  });

  app.get("/api/approvals", async (_request, reply) => {
    return reply.send({ ok: true, data: queryApprovals() });
  });

  app.post<{ Body: Record<string, unknown> }>("/api/instructions", async (request, reply) => {
    const text = typeof request.body["text"] === "string" ? request.body["text"].trim() : "";
    if (!text) {
      return reply.status(400).send({ ok: false, error: "text is required" });
    }

    const result = await submitBuyInstruction(text, "ui");
    if (result.ok) {
      return reply.send({ ok: true, approvalId: result.approvalId, symbol: result.symbol });
    }
    return reply.status(422).send({ ok: false, error: result.error });
  });

  app.post<{ Params: { id: string } }>("/api/approvals/:id/approve", async (request, reply) => {
    const approvalId = request.params.id;
    const approval = getApproval(approvalId);
    if (!approval) {
      return reply.status(404).send({ ok: false, error: "Approval not found" });
    }
    if (approval.status !== "pending") {
      return reply.status(409).send({ ok: false, error: `Already ${approval.status}` });
    }

    const runId = crypto.randomUUID();
    db.insert(agentRuns)
      .values({ id: runId, startedAt: new Date().toISOString(), status: "running" })
      .run();

    const result = await executeApprovedInstruction(approvalId, runId);
    db.update(agentRuns)
      .set({ completedAt: new Date().toISOString(), status: result.ok ? "success" : "error" })
      .where(eq(agentRuns.id, runId))
      .run();

    if (result.ok) {
      return reply.send({ ok: true });
    }
    return reply.status(422).send({ ok: false, error: result.error });
  });

  app.delete<{ Params: { id: string } }>("/api/gtt/:id", async (request, reply) => {
    const id = request.params.id;
    const row = db.select().from(gttOrders).where(eq(gttOrders.id, id)).get();
    if (!row) {
      return reply.status(404).send({ ok: false, error: "GTT order not found" });
    }
    if (row.status !== "active") {
      return reply.status(409).send({ ok: false, error: `Order is already ${row.status}` });
    }

    if (isDryRunActive()) {
      logger.info("[DRY_RUN] would cancel GTT", { id, symbol: row.symbol });
    } else {
      logger.warn("GTT cancelled in DB; Upstox remote cancel unavailable without upstoxOrderId", {
        id,
        symbol: row.symbol,
      });
    }

    db.update(gttOrders)
      .set({ status: "cancelled", updatedAt: new Date().toISOString() })
      .where(eq(gttOrders.id, id))
      .run();
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>("/api/approvals/:id/reject", async (request, reply) => {
    const approvalId = request.params.id;
    const approval = getApproval(approvalId);
    if (!approval) {
      return reply.status(404).send({ ok: false, error: "Approval not found" });
    }
    if (approval.status !== "pending") {
      return reply.status(409).send({ ok: false, error: `Already ${approval.status}` });
    }

    resolveApproval(approvalId, "rejected");

    if (approval.slackTs) {
      updateApprovalCard(approval.slackTs, approval.symbol, "rejected").catch((error: unknown) => {
        logger.warn("Failed to update Slack card after UI rejection", {
          approvalId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return reply.send({ ok: true });
  });

  /**
   * Update SL threshold and targets for a holding in stock_config.
   * Send null for targetOne/targetTwo to clear a previously set value.
   * Creates the row if it does not yet exist.
   * @param request - Fastify request with symbol param and HoldingConfigBody
   * @param reply - Fastify reply
   * @returns JSON {ok: true} on success or {ok: false, error} on failure
   */
  app.put<{ Params: { symbol: string }; Body: unknown }>(
    "/api/holdings/:symbol/config",
    async (request, reply) => {
      const symbol = request.params.symbol;

      const parsed = HoldingConfigBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: parsed.error.issues.map((issue) => issue.message).join("; "),
        });
      }

      const { slThreshold, targetOne, targetTwo } = parsed.data;
      const now = new Date().toISOString();

      try {
        const existing = db.select().from(stockConfig).where(eq(stockConfig.symbol, symbol)).get();

        if (existing) {
          db.update(stockConfig)
            .set({ slThreshold, targetOne, targetTwo, updatedAt: now })
            .where(eq(stockConfig.symbol, symbol))
            .run();
        } else {
          db.insert(stockConfig)
            .values({ symbol, slThreshold, targetOne, targetTwo, updatedAt: now })
            .run();
        }

        logger.info("stock_config updated via UI", { symbol, slThreshold, targetOne, targetTwo });
        return reply.send({ ok: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("PUT /api/holdings/:symbol/config failed", { symbol, error: message });
        db.insert(agentLogs)
          .values({
            runId: "ui",
            symbol,
            action: "stock_config_update_failed",
            reasoning: null,
            dryRun: false,
            error: message,
            createdAt: now,
          })
          .run();
        return reply.status(500).send({ ok: false, error: message });
      }
    },
  );

  // ── Phase 7: Watchlist ────────────────────────────────────────────────────

  app.get("/api/watchlist", async (_request, reply) => {
    const entries = getWatchlist();
    const levelsBySymbol: Record<string, { dma200: number | null }> = {};
    const instrumentKeyMap: Record<string, string> = {};
    for (const entry of entries) {
      const levels = getCachedLevels(entry.symbol);
      if (levels) levelsBySymbol[entry.symbol] = { dma200: levels.dma200 };
    }
    await Promise.allSettled(
      entries.map(async (entry) => {
        const resolved = await resolveSymbol(entry.symbol);
        if (resolved.ok) {
          instrumentKeyMap[entry.symbol] = resolved.value.instrumentToken;
        } else {
          logger.warn("GET /api/watchlist: resolveSymbol failed", {
            symbol: entry.symbol,
            error: resolved.error.message,
          });
        }
      }),
    );
    const proximityAlerts = await checkProximity(entries, levelsBySymbol, instrumentKeyMap);
    return reply.send({ ok: true, data: { entries, proximityAlerts } });
  });

  app.post<{ Body: unknown }>("/api/watchlist", async (request, reply) => {
    const BodySchema = z.object({
      symbol: z.string().min(1),
      displayName: z.string().min(1),
      notes: z.string().optional(),
    });
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message });
    }
    const result = addToWatchlist(parsed.data.symbol, parsed.data.displayName, parsed.data.notes);
    if (!result.ok) {
      return reply.status(409).send({ ok: false, error: result.error.message });
    }
    return reply.send({ ok: true });
  });

  app.delete<{ Params: { symbol: string } }>("/api/watchlist/:symbol", async (request, reply) => {
    const result = removeFromWatchlist(request.params.symbol);
    if (!result.ok) {
      return reply.status(500).send({ ok: false, error: result.error.message });
    }
    return reply.send({ ok: true });
  });

  // ── Phase 7: Portfolio Health ─────────────────────────────────────────────

  app.get("/api/health", async (_request, reply) => {
    const cached = getLastHealthReport();
    if (cached) {
      return reply.send({ ok: true, data: cached });
    }
    const result = await computeHealthReport();
    if (!result.ok) {
      logger.error("Health report computation failed", { error: result.error.message });
      return reply.status(500).send({ ok: false, error: result.error.message });
    }
    setLastHealthReport(result.value);
    return reply.send({ ok: true, data: result.value });
  });

  app.post("/api/health/run", async (_request, reply) => {
    const result = await computeHealthReport();
    if (!result.ok) {
      logger.error("Health report computation failed", { error: result.error.message });
      return reply.status(500).send({ ok: false, error: result.error.message });
    }
    setLastHealthReport(result.value);
    return reply.send({ ok: true, data: result.value });
  });

  // ── Phase 7: Advisor ──────────────────────────────────────────────────────

  app.get("/api/advisor/conversations", async (_request, reply) => {
    const rows = db
      .select()
      .from(advisoryConversations)
      .orderBy(desc(advisoryConversations.createdAt))
      .limit(100)
      .all();
    return reply.send({ ok: true, data: rows });
  });

  app.post<{ Body: unknown }>("/api/advisor/ask", async (request, reply) => {
    const BodySchema = z.object({
      question: z.string().min(1),
      sessionId: z.string().uuid().optional(),
    });
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message });
    }
    const result = await askAdvisor({
      question: parsed.data.question,
      sessionId: parsed.data.sessionId ?? crypto.randomUUID(),
      channel: "ui",
    });
    if (!result.ok) {
      return reply.status(500).send({ ok: false, error: result.error.message });
    }
    return reply.send({ ok: true, answer: result.value.answer, sessionId: result.value.sessionId });
  });

  app.get<{ Params: { symbol: string } }>("/api/advisor/setup/:symbol", async (request, reply) => {
    const { symbol } = request.params;
    const resolveResult = await resolveSymbol(symbol);
    if (!resolveResult.ok) {
      return reply
        .status(404)
        .send({ ok: false, error: `Symbol not found: ${resolveResult.error.message}` });
    }
    const { tradingSymbol, instrumentToken } = resolveResult.value;

    let levels = getCachedLevels(tradingSymbol);
    if (!levels) {
      const ohlcvResult = await fetchOHLCV(instrumentToken, 260);
      if (!ohlcvResult.ok) {
        return reply.status(502).send({ ok: false, error: ohlcvResult.error.message });
      }
      levels = computeLevels(tradingSymbol, ohlcvResult.value);
      saveLevels(levels);
    }

    const setupResult = await generateTradeSetup(tradingSymbol, JSON.stringify(levels));
    if (!setupResult.ok) {
      return reply.status(500).send({ ok: false, error: setupResult.error.message });
    }
    return reply.send({ ok: true, data: setupResult.value });
  });

  return app;
}

/**
 * Start the REST API server on AGENT_API_PORT.
 * Call once from main.ts after all other services are up.
 */
export async function startApiServer(): Promise<void> {
  const app = await buildApiApp();
  await app.listen({ port: env.AGENT_API_PORT, host: "0.0.0.0" });
  logger.info("REST API server started", { port: env.AGENT_API_PORT });
}

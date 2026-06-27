import crypto from "node:crypto";

import { desc, eq } from "drizzle-orm";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";

import { db } from "../db/db.js";
import { agentLogs, agentRuns, agentSettings, gttOrders, pendingApprovals } from "../db/schema.js";
import { getApproval, resolveApproval } from "../features/approval/approval.store.js";
import { updateApprovalCard } from "../features/instructions/instructions.approval.js";
import { executeApprovedInstruction } from "../features/instructions/instructions.executor.js";
import { submitBuyInstruction } from "../features/instructions/instructions.pipeline.js";
import { ParsedInstructionSchema } from "../features/instructions/instructions.schema.js";
import { getCachedHoldings } from "../features/portfolio/portfolio.cache.js";
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
    dryRun:
      overrides["dry_run"] === "true"
        ? true
        : overrides["dry_run"] === "false"
          ? false
          : env.DRISHTI_DRY_RUN,
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

// ── Express app ───────────────────────────────────────────────────────────────

function corsMiddleware(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_request.method === "OPTIONS") {
    response.sendStatus(200);
    return;
  }
  next();
}

/**
 * Build and return the configured Express app (without starting the server).
 * Separated from startApiServer for testability.
 * @returns Configured Express application
 */
export function buildApiApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  app.get("/api/runs", (_request, response) => {
    response.json({ ok: true, data: queryRuns() });
  });

  app.get("/api/holdings", (_request, response) => {
    const { holdings, cachedAt } = getCachedHoldings();
    response.json({ ok: true, data: holdings, cachedAt });
  });

  app.get("/api/gtt", (request, response) => {
    const status =
      typeof request.query["status"] === "string" ? request.query["status"] : undefined;
    response.json({ ok: true, data: queryGttOrders(status) });
  });

  app.get("/api/logs", (request, response) => {
    const runId = typeof request.query["runId"] === "string" ? request.query["runId"] : undefined;
    response.json({ ok: true, data: queryLogs(runId) });
  });

  app.get("/api/settings", (_request, response) => {
    response.json({ ok: true, data: querySettings() });
  });

  app.put("/api/settings", (request, response) => {
    const raw: unknown = request.body;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      response.status(400).json({ ok: false, error: "Body must be a JSON object" });
      return;
    }
    const body = raw as Record<string, unknown>;
    const allowed = new Set(["dry_run", "pause_agent", "poll_interval_minutes"]);
    const now = new Date().toISOString();

    const updated: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key)) continue;
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

    response.json({ ok: true, updated });
  });

  app.get("/api/approvals", (_request, response) => {
    response.json({ ok: true, data: queryApprovals() });
  });

  app.post("/api/instructions", (request, response) => {
    const raw: unknown = request.body;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      response.status(400).json({ ok: false, error: "Body must be a JSON object" });
      return;
    }
    const body = raw as Record<string, unknown>;
    const text = typeof body["text"] === "string" ? body["text"].trim() : "";
    if (!text) {
      response.status(400).json({ ok: false, error: "text is required" });
      return;
    }

    submitBuyInstruction(text, "ui")
      .then((result) => {
        if (result.ok) {
          response.json({ ok: true, approvalId: result.approvalId, symbol: result.symbol });
        } else {
          response.status(422).json({ ok: false, error: result.error });
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("POST /api/instructions failed", { error: message });
        response.status(500).json({ ok: false, error: message });
      });
  });

  app.post("/api/approvals/:id/approve", (request, response) => {
    const approvalId = request.params["id"] ?? "";
    const approval = getApproval(approvalId);
    if (!approval) {
      response.status(404).json({ ok: false, error: "Approval not found" });
      return;
    }
    if (approval.status !== "pending") {
      response.status(409).json({ ok: false, error: `Already ${approval.status}` });
      return;
    }

    const runId = crypto.randomUUID();
    db.insert(agentRuns)
      .values({ id: runId, startedAt: new Date().toISOString(), status: "running" })
      .run();

    executeApprovedInstruction(approvalId, runId)
      .then((result) => {
        db.update(agentRuns)
          .set({ completedAt: new Date().toISOString(), status: result.ok ? "success" : "error" })
          .where(eq(agentRuns.id, runId))
          .run();
        if (result.ok) {
          response.json({ ok: true });
        } else {
          response.status(422).json({ ok: false, error: result.error });
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("POST /api/approvals/:id/approve failed", { approvalId, error: message });
        db.update(agentRuns)
          .set({ completedAt: new Date().toISOString(), status: "error" })
          .where(eq(agentRuns.id, runId))
          .run();
        response.status(500).json({ ok: false, error: message });
      });
  });

  /**
   * Cancel an active GTT order. Dry-run logs and marks cancelled; live mode marks cancelled in DB
   * (remote Upstox cancel requires an upstoxOrderId column — schema migration pending).
   */
  app.delete("/api/gtt/:id", (request, response) => {
    const id = request.params["id"] ?? "";
    const row = db.select().from(gttOrders).where(eq(gttOrders.id, id)).get();
    if (!row) {
      response.status(404).json({ ok: false, error: "GTT order not found" });
      return;
    }
    if (row.status !== "active") {
      response.status(409).json({ ok: false, error: `Order is already ${row.status}` });
      return;
    }

    const now = new Date().toISOString();

    if (env.DRISHTI_DRY_RUN) {
      logger.info("[DRY_RUN] would cancel GTT", { id, symbol: row.symbol });
    } else {
      logger.warn("GTT cancelled in DB; Upstox remote cancel unavailable without upstoxOrderId", {
        id,
        symbol: row.symbol,
      });
    }

    db.update(gttOrders)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(gttOrders.id, id))
      .run();
    response.json({ ok: true });
  });

  app.post("/api/approvals/:id/reject", (request, response) => {
    const approvalId = request.params["id"] ?? "";
    const approval = getApproval(approvalId);
    if (!approval) {
      response.status(404).json({ ok: false, error: "Approval not found" });
      return;
    }
    if (approval.status !== "pending") {
      response.status(409).json({ ok: false, error: `Already ${approval.status}` });
      return;
    }

    resolveApproval(approvalId, "rejected");

    if (approval.slackTs) {
      updateApprovalCard(approval.slackTs, approval.symbol, "rejected")
        .then((result) => {
          if (!result.ok) {
            logger.warn("Failed to update Slack card after UI rejection", {
              approvalId,
              error: result.error.message,
            });
          }
        })
        .catch((error: unknown) => {
          logger.warn("Failed to update Slack card after UI rejection", {
            approvalId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    response.json({ ok: true });
  });

  return app;
}

/**
 * Start the REST API server on AGENT_API_PORT.
 * Call once from main.ts after all other services are up.
 */
export function startApiServer(): void {
  const app = buildApiApp();
  app.listen(env.AGENT_API_PORT, () => {
    logger.info("REST API server started", { port: env.AGENT_API_PORT });
  });
}

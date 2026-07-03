import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentRuns } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";

import { buildFastAgentGraph, buildSlowAgentGraph } from "./agent.graph.js";
import type { AgentState } from "./agent.state.js";

// Guards the slow (LLM analysis) phase only — separate from the cron's own
// isRunning guard, which gates the fast phase. This prevents two concurrent LLM
// analyses (e.g. a slow one from a prior tick still running when a new material
// event fires) without ever blocking the next tick's SL/target checks, which is
// exactly the latency risk this split exists to avoid.
let isSlowPhaseRunning = false;

/**
 * Run the slow phase (LLM portfolio analysis + resulting GTT/alert actions),
 * continuing from the fast phase's resulting state. Never awaited by tick() —
 * runs decoupled so a long analysis call can't delay the next scheduled tick.
 * @param fastState - The AgentState produced by the fast phase this tick
 */
export async function runSlowPhase(fastState: AgentState): Promise<void> {
  if (isSlowPhaseRunning) {
    logger.debug("Skipping slow analysis phase — previous slow phase still in progress", {
      runId: fastState.runId,
    });
    return;
  }

  isSlowPhaseRunning = true;
  try {
    const slowGraph = buildSlowAgentGraph();
    await slowGraph.run(fastState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error in slow analysis phase", {
      runId: fastState.runId,
      error: message,
    });
  } finally {
    isSlowPhaseRunning = false;
  }
}

/**
 * Run one agent tick: the fast phase (portfolio fetch + SL/target checks) always
 * runs and updates the agentRuns row; the slow phase (LLM analysis) is dispatched
 * decoupled afterward so it can never delay the next scheduled tick.
 */
export async function tick(): Promise<void> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  db.insert(agentRuns).values({ id: runId, startedAt, status: "running" }).run();
  logger.info("Agent tick started", { runId, dryRun: env.DRISHTI_DRY_RUN });

  try {
    const fastGraph = buildFastAgentGraph();
    const fastState = await fastGraph.run({
      runId,
      holdings: [],
      ltpMap: {},
      slConfigs: [],
      breaches: [],
      targetHits: [],
      llmOutput: null,
      errors: [],
    });

    const hasErrors = fastState.errors.length > 0;
    const status = hasErrors ? "failed" : "completed";
    const summary = hasErrors
      ? fastState.errors.join("; ")
      : `${fastState.holdings.length} holdings, ${fastState.breaches.length} SL breaches, ${fastState.targetHits.length} target hits`;

    db.update(agentRuns)
      .set({ status, completedAt: new Date().toISOString(), summary })
      .where(eq(agentRuns.id, runId))
      .run();

    logger.info("Agent tick completed", {
      runId,
      status,
      breaches: fastState.breaches.length,
      targetHits: fastState.targetHits.length,
      errors: fastState.errors.length,
    });

    // Decoupled on purpose — the next cron tick's fast phase must not wait on this.
    if (!hasErrors && fastState.holdings.length > 0) {
      void runSlowPhase(fastState);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error in agent tick", { runId, error: message });
    db.update(agentRuns)
      .set({ status: "failed", completedAt: new Date().toISOString(), summary: message })
      .where(eq(agentRuns.id, runId))
      .run();
  }
}

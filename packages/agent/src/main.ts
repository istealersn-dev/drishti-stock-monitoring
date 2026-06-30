import "dotenv/config";

import crypto from "node:crypto";

import bolt from "@slack/bolt";
import { eq } from "drizzle-orm";

const { App } = bolt;

import { startApiServer } from "./api/api.server.js";
import { db } from "./db/db.js";
import { agentRuns } from "./db/schema.js";
import { buildAgentGraph } from "./features/agent/agent.graph.js";
import { registerApprovalHandlers } from "./features/approval/approval.handler.js";
import { startTimeoutPoller } from "./features/approval/approval.timeout.js";
import { startDigestCrons } from "./features/digest/digest.service.js";
import { registerSlackCommands } from "./features/slack-commands/slackCommands.router.js";
import { startAdvisorCrons, startCron } from "./scheduler/cron.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";

async function tick(): Promise<void> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  db.insert(agentRuns).values({ id: runId, startedAt, status: "running" }).run();
  logger.info("Agent tick started", { runId, dryRun: env.DRISHTI_DRY_RUN });

  try {
    const graph = buildAgentGraph();
    const finalState = await graph.run({
      runId,
      holdings: [],
      ltpMap: {},
      slConfigs: [],
      breaches: [],
      targetHits: [],
      llmOutput: null,
      errors: [],
    });

    const hasErrors = finalState.errors.length > 0;
    const status = hasErrors ? "failed" : "completed";
    const summary = hasErrors
      ? finalState.errors.join("; ")
      : `${finalState.holdings.length} holdings, ${finalState.breaches.length} SL breaches, ${finalState.targetHits.length} target hits`;

    db.update(agentRuns)
      .set({ status, completedAt: new Date().toISOString(), summary })
      .where(eq(agentRuns.id, runId))
      .run();

    logger.info("Agent tick completed", {
      runId,
      status,
      breaches: finalState.breaches.length,
      targetHits: finalState.targetHits.length,
      errors: finalState.errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error in agent tick", { runId, error: message });
    db.update(agentRuns)
      .set({ status: "failed", completedAt: new Date().toISOString(), summary: message })
      .where(eq(agentRuns.id, runId))
      .run();
  }
}

async function main(): Promise<void> {
  const boltApp = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  registerApprovalHandlers(boltApp);
  registerSlackCommands(boltApp, env.SLACK_COMMAND_CHANNEL_ID);

  await boltApp.start();
  logger.info("Slack Bolt app started (socket mode)");

  startTimeoutPoller();
  startDigestCrons();
  startAdvisorCrons();
  await startApiServer();

  await tick();
  startCron(tick);
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

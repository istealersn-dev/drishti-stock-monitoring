import crypto from "node:crypto";

import type { App } from "@slack/bolt";
import type { ButtonAction } from "@slack/bolt";
import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentRuns } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";
import { updateApprovalCard } from "../instructions/instructions.approval.js";
import { executeApprovedInstruction } from "../instructions/instructions.executor.js";

import { getApproval, resolveApproval } from "./approval.store.js";

/**
 * Register Bolt interactive action handlers for buy approval buttons.
 * Must be called before app.start().
 * @param app - The Slack Bolt app instance
 */
export function registerApprovalHandlers(app: App): void {
  app.action("approve_buy", async ({ action, ack, body }) => {
    await ack();

    const buttonAction = action as ButtonAction;
    const approvalId = buttonAction.value ?? "";
    const actingUser = body.user.id;

    logger.info("Approval tap received: approve", { approvalId, actingUser });

    if (!approvalId) {
      logger.error("approve_buy action missing value (approvalId)");
      return;
    }

    const approval = getApproval(approvalId);
    if (!approval) {
      logger.error("Approval not found on approve tap", { approvalId });
      return;
    }

    if (approval.status !== "pending") {
      logger.warn("Approval already resolved on approve tap", {
        approvalId,
        status: approval.status,
      });
      return;
    }

    const runId = crypto.randomUUID();
    const runStartedAt = new Date().toISOString();
    db.insert(agentRuns).values({ id: runId, startedAt: runStartedAt, status: "running" }).run();

    const result = await executeApprovedInstruction(approvalId, runId);
    db.update(agentRuns)
      .set({
        completedAt: new Date().toISOString(),
        status: result.ok ? "success" : "error",
      })
      .where(eq(agentRuns.id, runId))
      .run();

    if (!result.ok) {
      logger.error("Buy instruction execution failed", { approvalId, error: result.error });
    }
  });

  app.action("reject_buy", async ({ action, ack, body }) => {
    await ack();

    const buttonAction = action as ButtonAction;
    const approvalId = buttonAction.value ?? "";
    const actingUser = body.user.id;

    logger.info("Approval tap received: reject", { approvalId, actingUser });

    if (!approvalId) {
      logger.error("reject_buy action missing value (approvalId)");
      return;
    }

    const approval = getApproval(approvalId);
    if (!approval) {
      logger.error("Approval not found on reject tap", { approvalId });
      return;
    }

    if (approval.status !== "pending") {
      logger.warn("Approval already resolved on reject tap", {
        approvalId,
        status: approval.status,
      });
      return;
    }

    resolveApproval(approvalId, "rejected");
    logger.info("Approval rejected", { approvalId, symbol: approval.symbol });

    if (approval.slackTs) {
      const updateResult = await updateApprovalCard(approval.slackTs, approval.symbol, "rejected");
      if (!updateResult.ok) {
        logger.warn("Failed to update approval card after rejection", {
          approvalId,
          error: updateResult.error.message,
        });
      }
    }
  });
}

import crypto from "node:crypto";

import type { App } from "@slack/bolt";
import type { ButtonAction } from "@slack/bolt";
import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentRuns } from "../../db/schema.js";
import { logger } from "../../shared/logger.js";
import {
  buildEditAmountModal,
  parseEditAmountSubmission,
  refreshApprovalCard,
  updateApprovalCard,
} from "../instructions/instructions.approval.js";
import { executeApprovedInstruction } from "../instructions/instructions.executor.js";
import { applyAmountOverride } from "../instructions/instructions.pipeline.js";
import { ParsedInstructionSchema } from "../instructions/instructions.schema.js";
import { fetchMargins } from "../portfolio/portfolio.tools.js";

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

  app.action("edit_amount", async ({ action, ack, body, client }) => {
    await ack();

    const buttonAction = action as ButtonAction;
    const approvalId = buttonAction.value ?? "";

    if (!approvalId) {
      logger.error("edit_amount action missing value (approvalId)");
      return;
    }

    const approval = getApproval(approvalId);
    if (!approval || approval.status !== "pending") {
      logger.warn("Edit-amount tap on missing/resolved approval", { approvalId });
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(approval.parsedJson);
    } catch {
      logger.error("edit_amount: failed to parse stored instruction", { approvalId });
      return;
    }
    const parsedResult = ParsedInstructionSchema.safeParse(raw);
    if (!parsedResult.success || !parsedResult.data.entryHigh) {
      logger.error("edit_amount: instruction missing entry price", { approvalId });
      return;
    }
    const { entryHigh, entryLow } = parsedResult.data;
    const midpoint = ((entryLow ?? entryHigh) + entryHigh) / 2;
    const currentQty = approval.overrideQty ?? approval.suggestedQty;
    const currentAmountInr = midpoint * currentQty;

    const triggerId = "trigger_id" in body ? body.trigger_id : undefined;
    if (!triggerId) {
      logger.error("edit_amount: missing trigger_id", { approvalId });
      return;
    }

    await client.views.open({
      trigger_id: triggerId,
      view: buildEditAmountModal(approvalId, currentAmountInr),
    });
  });

  app.view("edit_amount_modal", async ({ ack, view }) => {
    const submission = parseEditAmountSubmission(view);
    if (!submission.ok) {
      await ack({
        response_action: "errors",
        errors: { amount_block: submission.error },
      });
      return;
    }
    await ack();

    const { approvalId, amountInr } = submission;
    const overrideResult = applyAmountOverride(approvalId, amountInr);
    if (!overrideResult.ok) {
      logger.warn("Failed to apply amount override from Slack modal", {
        approvalId,
        error: overrideResult.error,
      });
      return;
    }

    logger.info("Approval amount overridden via Slack", {
      approvalId,
      amountInr,
      qty: overrideResult.qty,
    });

    const approval = getApproval(approvalId);
    if (!approval?.slackTs) return;

    let raw: unknown;
    try {
      raw = JSON.parse(approval.parsedJson);
    } catch {
      return;
    }
    const parsedResult = ParsedInstructionSchema.safeParse(raw);
    if (!parsedResult.success) return;

    const marginResult = await fetchMargins();
    const availableMargin = marginResult.ok ? marginResult.value.available_margin : 0;

    const refreshResult = await refreshApprovalCard(
      approval.slackTs,
      approvalId,
      parsedResult.data,
      approval.symbol,
      overrideResult.qty,
      availableMargin,
    );
    if (!refreshResult.ok) {
      logger.warn("Failed to refresh approval card after amount edit", {
        approvalId,
        error: refreshResult.error.message,
      });
    }
  });
}

import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { buildSlExitRequest } from "../gtt/gtt.service.js";
import { cancelGTT, createGTT } from "../gtt/gtt.tools.js";
import { analysePortfolio } from "../insights/insights.chain.js";
import { updateHoldingsCache } from "../portfolio/portfolio.cache.js";
import { fetchHoldings, fetchLTP } from "../portfolio/portfolio.tools.js";
import { loadSlConfigs } from "../stopLoss/stopLoss.config.js";
import { detectBreaches } from "../stopLoss/stopLoss.detector.js";
import { handleSlBreach } from "../stopLoss/stopLoss.handler.js";
import { detectTargetHits, loadTargetConfigs } from "../targets/targets.detector.js";

import { StateGraph } from "./agent.state.js";
import type { AgentState } from "./agent.state.js";

const GTT_LIMIT_BUFFER = 0.995;

/** Fetch holdings and LTP; populate state or append to errors on failure. */
async function fetchPortfolioNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  const holdingsResult = await fetchHoldings();
  if (!holdingsResult.ok) {
    logger.error("fetchPortfolio: holdings fetch failed", {
      error: holdingsResult.error.message,
    });
    return {
      errors: [...state.errors, `fetch_holdings: ${holdingsResult.error.message}`],
    };
  }

  const holdings = holdingsResult.value;
  updateHoldingsCache(holdings);
  if (holdings.length === 0) {
    logger.info("fetchPortfolio: no holdings");
    return { holdings: [] };
  }

  const instrumentKeys = holdings.map((h) => h.instrument_token).join(",");
  const ltpResult = await fetchLTP(instrumentKeys);
  if (!ltpResult.ok) {
    logger.error("fetchPortfolio: LTP fetch failed", { error: ltpResult.error.message });
    return {
      holdings,
      errors: [...state.errors, `fetch_ltp: ${ltpResult.error.message}`],
    };
  }

  const ltpMap = ltpResult.value;
  const slConfigs = loadSlConfigs();

  logger.info("fetchPortfolio: complete", {
    runId: state.runId,
    holdings: holdings.length,
    configured: slConfigs.length,
  });

  return { holdings, ltpMap, slConfigs };
}

/** Detect and handle SL breaches; auto-places GTT exits. */
async function checkStopLossNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0 || state.errors.length > 0) return {};

  const breaches = detectBreaches(state.holdings, state.ltpMap, state.slConfigs);

  logger.info("checkStopLoss: scan complete", {
    runId: state.runId,
    breaches: breaches.length,
  });

  for (const breach of breaches) {
    await handleSlBreach(breach, state.runId);
  }

  return { breaches };
}

/** Detect T1/T2 target hits; alert-only, no auto-action. */
async function checkTargetsNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0 || state.errors.length > 0) return {};

  const configs = loadTargetConfigs();
  const targetHits = detectTargetHits(state.holdings, state.ltpMap, configs);

  for (const hit of targetHits) {
    const label = hit.targetLevel === 1 ? "T1" : "T2";
    const alertResult = await pushAlert(
      `🎯 *${hit.companyName}* (${hit.symbol}) hit ${label} target ₹${hit.targetPrice}. LTP: ₹${hit.currentPrice}. Review position.`,
    );
    if (!alertResult.ok) {
      logger.warn("checkTargets: alert failed", {
        symbol: hit.symbol,
        error: alertResult.error.message,
      });
    }

    db.insert(agentLogs)
      .values({
        runId: state.runId,
        symbol: hit.symbol,
        action: `target_${label.toLowerCase()}_hit`,
        reasoning: `${label} target ₹${hit.targetPrice} reached at LTP ₹${hit.currentPrice}`,
        dryRun: env.DRISHTI_DRY_RUN,
        error: null,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  logger.info("checkTargets: scan complete", {
    runId: state.runId,
    hits: targetHits.length,
  });

  return { targetHits };
}

/** Run LLM analysis over portfolio state; falls back to empty decisions on error. */
async function llmAnalyseNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0 || state.errors.length > 0) return {};

  const result = await analysePortfolio(state.holdings, state.ltpMap, state.slConfigs);

  if (!result.ok) {
    logger.warn("llmAnalyse: analysis failed, skipping", { error: result.error.message });
    db.insert(agentLogs)
      .values({
        runId: state.runId,
        action: "llm_analyse_failed",
        reasoning: null,
        dryRun: env.DRISHTI_DRY_RUN,
        error: result.error.message,
        createdAt: new Date().toISOString(),
      })
      .run();
    return {};
  }

  logger.info("llmAnalyse: complete", {
    runId: state.runId,
    decisions: result.value.decisions.length,
  });

  return { llmOutput: result.value };
}

/**
 * Look up the active buy-entry GTT order ID for a symbol from the local DB.
 * Returns null when none is found (GTT may have already triggered or been cancelled).
 */
function findActiveGttId(symbol: string): string | null {
  const rows = db
    .select({ id: gttOrders.id })
    .from(gttOrders)
    .where(eq(gttOrders.symbol, symbol))
    .all();

  return rows[0]?.id ?? null;
}

/** Execute LLM decisions: modify or cancel GTTs. Hold and alert_only are fire-and-forget alerts. */
async function executeActionsNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (!state.llmOutput) return {};

  for (const decision of state.llmOutput.decisions) {
    const now = new Date().toISOString();

    if (decision.action === "hold") {
      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "hold",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: null,
          createdAt: now,
        })
        .run();
      continue;
    }

    if (decision.action === "alert_only") {
      const alertResult = await pushAlert(`👁 *${decision.symbol}*: ${decision.reasoning}`);
      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "alert_only",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: alertResult.ok ? null : alertResult.error.message,
          createdAt: now,
        })
        .run();
      continue;
    }

    if (decision.action === "gtt_cancel") {
      const gttId = findActiveGttId(decision.symbol);
      if (!gttId) {
        logger.warn("executeActions: no active GTT found for cancel", {
          symbol: decision.symbol,
        });
        continue;
      }

      const cancelResult = await cancelGTT(gttId);
      if (cancelResult.ok) {
        db.update(gttOrders)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(gttOrders.id, gttId))
          .run();
      }
      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "gtt_cancel",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: cancelResult.ok ? null : cancelResult.error.message,
          createdAt: now,
        })
        .run();
      continue;
    }

    if (decision.action === "gtt_modify" && decision.gttParams) {
      const gttId = findActiveGttId(decision.symbol);
      if (!gttId) {
        logger.warn("executeActions: no active GTT found for modify", {
          symbol: decision.symbol,
        });
        continue;
      }

      const holding = state.holdings.find((h) => h.trading_symbol === decision.symbol);
      if (!holding) continue;

      const cancelResult = await cancelGTT(gttId);
      if (!cancelResult.ok) {
        logger.error("executeActions: cancel before modify failed", {
          symbol: decision.symbol,
          error: cancelResult.error.message,
        });
        db.insert(agentLogs)
          .values({
            runId: state.runId,
            symbol: decision.symbol,
            action: "gtt_modify_failed",
            reasoning: decision.reasoning,
            dryRun: env.DRISHTI_DRY_RUN,
            error: cancelResult.error.message,
            createdAt: now,
          })
          .run();
        continue;
      }

      db.update(gttOrders)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(gttOrders.id, gttId))
        .run();

      const newRequest = buildSlExitRequest(holding, decision.gttParams.newTriggerPrice);
      const newLimitPrice = Number(
        (decision.gttParams.newTriggerPrice * GTT_LIMIT_BUFFER).toFixed(2),
      );

      const createResult = await createGTT({
        ...newRequest,
        limit_price: newLimitPrice,
      });

      if (createResult.ok) {
        db.insert(gttOrders)
          .values({
            id: crypto.randomUUID(),
            symbol: decision.symbol,
            type: "sl_exit",
            triggerPrice: decision.gttParams.newTriggerPrice,
            limitPrice: newLimitPrice,
            quantity: holding.quantity,
            status: env.DRISHTI_DRY_RUN ? "dry_run" : "active",
            approvalId: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "gtt_modify",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: createResult.ok ? null : createResult.error.message,
          createdAt: now,
        })
        .run();
    }
  }

  return {};
}

/** Push portfolio summary to Slack and log it. */
async function logAndAlertNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0) return {};

  const summary = state.llmOutput?.portfolioSummary ?? "Portfolio analysed — no LLM summary.";
  const alertResult = await pushAlert(`📊 *Portfolio Update*\n${summary}`);

  if (!alertResult.ok) {
    logger.error("logAndAlert: Slack push failed", { error: alertResult.error.message });
  }

  db.insert(agentLogs)
    .values({
      runId: state.runId,
      action: "portfolio_summary",
      reasoning: summary,
      dryRun: env.DRISHTI_DRY_RUN,
      error: alertResult.ok ? null : alertResult.error.message,
      createdAt: new Date().toISOString(),
    })
    .run();

  return {};
}

/**
 * Build and return the Drishti agent StateGraph.
 * Nodes execute in order: fetchPortfolio → checkStopLoss → checkTargets → llmAnalyse → executeActions → logAndAlert.
 * @returns A configured StateGraph ready to run
 */
export function buildAgentGraph(): StateGraph {
  return new StateGraph()
    .addNode("fetchPortfolio", fetchPortfolioNode)
    .addNode("checkStopLoss", checkStopLossNode)
    .addNode("checkTargets", checkTargetsNode)
    .addNode("llmAnalyse", llmAnalyseNode)
    .addNode("executeActions", executeActionsNode)
    .addNode("logAndAlert", logAndAlertNode);
}

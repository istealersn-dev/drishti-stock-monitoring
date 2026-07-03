import { and, eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentLogs, gttOrders } from "../../db/schema.js";
import { isMarketOpen } from "../../scheduler/cron.js";
import { TRADING_DAY_MS, wasRecentlyAlerted } from "../../shared/dedup.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { buildSlExitRequest } from "../gtt/gtt.service.js";
import { cancelGTT, createGTT } from "../gtt/gtt.tools.js";
import { hasMovedSignificantly, recordAnalysisSnapshot } from "../insights/insights.cache.js";
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

const ALERT_ONLY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between repeated alert_only alerts
const PORTFOLIO_SENTINEL = "__portfolio__"; // symbol key for portfolio-level agent_logs rows
const LLM_ANALYSE_GATE_ACTION = "llm_analyse_gate"; // marks an attempted (not necessarily successful) LLM analysis, for fallback cadence

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
    const action = `target_${label.toLowerCase()}_hit`;

    if (wasRecentlyAlerted(action, hit.symbol, TRADING_DAY_MS)) {
      logger.debug("checkTargets: suppressing duplicate alert", {
        symbol: hit.symbol,
        label,
      });
      continue;
    }

    const alertResult = await pushAlert(
      `🎯 *${hit.companyName}* (${hit.symbol}) hit ${label} target ₹${hit.targetPrice}. LTP: ₹${hit.currentPrice}. Review position.`,
    );
    if (!alertResult.ok) {
      logger.warn("checkTargets: alert failed — skipping dedup log to allow retry", {
        symbol: hit.symbol,
        error: alertResult.error.message,
      });
      continue;
    }

    db.insert(agentLogs)
      .values({
        runId: state.runId,
        symbol: hit.symbol,
        action,
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

/**
 * Run LLM analysis over portfolio state; skips outside market hours, on errors, and
 * when nothing material has happened. A call is only made when: a SL breach or target
 * hit fired this run, a holding has moved beyond DRISHTI_LLM_MOVE_THRESHOLD_PCT since
 * the last analysis, or no analysis has run yet this trading session (fallback cadence).
 */
async function llmAnalyseNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0 || state.errors.length > 0) return {};

  if (!isMarketOpen()) {
    logger.debug("llmAnalyse: market closed — skipping portfolio LLM");
    return { llmOutput: null };
  }

  const hasMaterialEvent = state.breaches.length > 0 || state.targetHits.length > 0;
  const movedSignificantly = hasMovedSignificantly(
    state.holdings,
    state.ltpMap,
    env.DRISHTI_LLM_MOVE_THRESHOLD_PCT,
  );
  const fallbackDue = !wasRecentlyAlerted(
    LLM_ANALYSE_GATE_ACTION,
    PORTFOLIO_SENTINEL,
    TRADING_DAY_MS,
  );

  if (!hasMaterialEvent && !movedSignificantly && !fallbackDue) {
    logger.debug("llmAnalyse: no material change — skipping LLM call");
    return { llmOutput: null };
  }

  const result = await analysePortfolio(state.holdings, state.ltpMap, state.slConfigs);

  if (!result.ok) {
    logger.warn("llmAnalyse: analysis failed — skipping Slack alerts", {
      error: result.error.message,
    });
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
    // No llm_analyse_gate row on failure — the fallback cadence stays due so the
    // next tick retries, instead of going silent for the rest of the trading day.
    return { llmOutput: null };
  }

  logger.info("llmAnalyse: complete", {
    runId: state.runId,
    decisions: result.value.decisions.length,
  });

  db.insert(agentLogs)
    .values({
      runId: state.runId,
      symbol: PORTFOLIO_SENTINEL,
      action: LLM_ANALYSE_GATE_ACTION,
      reasoning: null,
      dryRun: env.DRISHTI_DRY_RUN,
      error: null,
      createdAt: new Date().toISOString(),
    })
    .run();
  recordAnalysisSnapshot(state.holdings, state.ltpMap);

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
    .where(and(eq(gttOrders.symbol, symbol), eq(gttOrders.status, "active")))
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
      if (wasRecentlyAlerted("alert_only", decision.symbol, ALERT_ONLY_COOLDOWN_MS)) {
        logger.debug("executeActions: suppressing duplicate alert_only", {
          symbol: decision.symbol,
        });
        continue;
      }

      const alertResult = await pushAlert(`👁 *${decision.symbol}*: ${decision.reasoning}`);
      if (!alertResult.ok) {
        logger.warn("executeActions: alert_only push failed — skipping dedup log to allow retry", {
          symbol: decision.symbol,
          error: alertResult.error.message,
        });
        continue;
      }

      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "alert_only",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: null,
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

    if (decision.action === "gtt_modify" && !decision.gttParams) {
      logger.warn("executeActions: gtt_modify decision missing gttParams — skipping", {
        symbol: decision.symbol,
      });
      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "gtt_modify_failed",
          reasoning: decision.reasoning,
          dryRun: env.DRISHTI_DRY_RUN,
          error: "gttParams missing in LLM decision",
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

/** Push LLM portfolio summary to Slack once per trading session, then log to DB. */
async function logAndAlertNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  if (state.holdings.length === 0) return {};
  if (!state.llmOutput) return {};

  const summary = state.llmOutput.portfolioSummary ?? "Portfolio analysed — no LLM summary.";

  // Suppress repeated summaries within the same trading session — one push per 8h window.
  // PORTFOLIO_SENTINEL is the symbol key used in agent_logs for portfolio-level events.
  if (wasRecentlyAlerted("portfolio_summary", PORTFOLIO_SENTINEL, TRADING_DAY_MS)) {
    logger.debug("logAndAlert: portfolio summary already pushed this session — skipping");
    return {};
  }

  const alertResult = await pushAlert(`📊 *Portfolio Update*\n${summary}`);
  if (!alertResult.ok) {
    logger.warn("logAndAlert: Slack push failed", { error: alertResult.error.message });
    return {};
  }

  db.insert(agentLogs)
    .values({
      runId: state.runId,
      symbol: PORTFOLIO_SENTINEL,
      action: "portfolio_summary",
      reasoning: summary,
      dryRun: env.DRISHTI_DRY_RUN,
      error: null,
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

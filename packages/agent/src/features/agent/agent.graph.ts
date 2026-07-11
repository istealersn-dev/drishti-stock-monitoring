import { and, eq } from "drizzle-orm";

import { getActiveBrokerClient } from "../../broker/brokerClient.registry.js";
import { db } from "../../db/db.js";
import { agentLogs, gttOrders } from "../../db/schema.js";
import { isMarketOpen } from "../../scheduler/cron.js";
import { wasRecentlyAlerted } from "../../shared/dedup.js";
import { isDryRunActive } from "../../shared/dryRun.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { TRADING_DAY_MS } from "../../shared/timeWindows.js";
import { pushAlert } from "../alerts/alerts.slack.js";
import { buildSlExitRequest } from "../gtt/gtt.service.js";
import { hasMovedSignificantly, recordAnalysisSnapshot } from "../insights/insights.cache.js";
import { analysePortfolio } from "../insights/insights.chain.js";
import { updateHoldingsCache } from "../portfolio/portfolio.cache.js";
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

const AUTH_FAILURE_ACTION = "upstox_auth_failure";
const HTTP_UNAUTHORIZED = 401;
// A dead token stays dead until someone refreshes it, so re-alert on a slow cadence
// rather than once — a single missed Slack message shouldn't leave SL monitoring
// blind for the rest of the day.
const AUTH_FAILURE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/**
 * Dead-man switch for a stale or revoked Upstox token. A 401 on the holdings fetch
 * never self-heals — unlike a transient network failure — so alert on the first
 * occurrence (with a cooldown) instead of letting every tick fail silently until
 * someone reads the logs. The dedup row is only written after confirmed delivery,
 * matching the target-hit alert pattern.
 */
async function alertUpstoxAuthFailure(runId: string, errorMessage: string): Promise<void> {
  if (wasRecentlyAlerted(AUTH_FAILURE_ACTION, PORTFOLIO_SENTINEL, AUTH_FAILURE_COOLDOWN_MS)) {
    return;
  }

  const alertResult = await pushAlert(
    `🔑 *Upstox token rejected (401)* — portfolio polling and SL monitoring are blind until it's refreshed.\n` +
      `Check the token-refresh launchd job, or refresh manually and restart:\n` +
      "`cd packages/token-refresh && node --import tsx src/runDailyRefresh.ts && pm2 restart drishti-agent`",
  );
  if (!alertResult.ok) {
    logger.warn("authFailure: alert failed — skipping dedup log to allow retry", {
      error: alertResult.error.message,
    });
    return;
  }

  db.insert(agentLogs)
    .values({
      runId,
      symbol: PORTFOLIO_SENTINEL,
      action: AUTH_FAILURE_ACTION,
      reasoning: `Upstox auth failure on holdings fetch: ${errorMessage}`,
      dryRun: isDryRunActive(),
      error: errorMessage,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** Fetch holdings and LTP; populate state or append to errors on failure. */
async function fetchPortfolioNode(state: Readonly<AgentState>): Promise<Partial<AgentState>> {
  const broker = getActiveBrokerClient();
  const holdingsResult = await broker.fetchHoldings();
  if (!holdingsResult.ok) {
    logger.error("fetchPortfolio: holdings fetch failed", {
      error: holdingsResult.error.message,
    });
    if (holdingsResult.error.statusCode === HTTP_UNAUTHORIZED) {
      await alertUpstoxAuthFailure(state.runId, holdingsResult.error.message);
    }
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

  const instrumentKeys = holdings.map((h) => h.instrumentToken);
  const ltpResult = await broker.fetchQuotes(instrumentKeys);
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
        dryRun: isDryRunActive(),
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
        dryRun: isDryRunActive(),
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
      dryRun: isDryRunActive(),
      error: null,
      createdAt: new Date().toISOString(),
    })
    .run();
  recordAnalysisSnapshot(state.holdings, state.ltpMap);

  return { llmOutput: result.value };
}

/**
 * Look up the active GTT order for a symbol from the local DB — both the local row ID
 * (used to update `gtt_orders.status`) and the Upstox order ID (required to cancel the
 * order remotely; null for rows created before this field existed, or during dry-run).
 * Returns null when no active row is found (GTT may have already triggered or been cancelled).
 */
function findActiveGtt(symbol: string): { id: string; upstoxOrderId: string | null } | null {
  const rows = db
    .select({ id: gttOrders.id, upstoxOrderId: gttOrders.upstoxOrderId })
    .from(gttOrders)
    .where(and(eq(gttOrders.symbol, symbol), eq(gttOrders.status, "active")))
    .all();

  return rows[0] ?? null;
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
          dryRun: isDryRunActive(),
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
          dryRun: isDryRunActive(),
          error: null,
          createdAt: now,
        })
        .run();
      continue;
    }

    if (decision.action === "gtt_cancel") {
      const gtt = findActiveGtt(decision.symbol);
      if (!gtt) {
        logger.warn("executeActions: no active GTT found for cancel", {
          symbol: decision.symbol,
        });
        continue;
      }

      const dryRun = isDryRunActive();
      if (!dryRun && !gtt.upstoxOrderId) {
        logger.error(
          "executeActions: active GTT row has no Upstox order ID — cannot cancel remotely",
          {
            symbol: decision.symbol,
            gttId: gtt.id,
          },
        );
        db.insert(agentLogs)
          .values({
            runId: state.runId,
            symbol: decision.symbol,
            action: "gtt_cancel",
            reasoning: decision.reasoning,
            dryRun,
            error: "Active GTT row has no Upstox order ID — cannot cancel remotely",
            createdAt: now,
          })
          .run();
        continue;
      }

      // The guard above guarantees upstoxOrderId is set whenever !dryRun; the `?? gtt.id`
      // fallback only fires in dry-run mode, where cancelGTT never touches the network and
      // the id is only used cosmetically in the "[DRY_RUN] would cancel" log string.
      const cancelResult = await getActiveBrokerClient().cancelTriggerOrder(
        gtt.upstoxOrderId ?? gtt.id,
        dryRun,
      );
      // Only flip the row to "cancelled" when a real Upstox cancel happened — cancelGTT
      // returns ok:true for a dry-run "would cancel" too, and marking the row cancelled
      // in that case would make the agent believe the real GTT is gone when Upstox still
      // has it live, which could cause a duplicate real exit GTT once dry-run is turned off.
      if (cancelResult.ok && !dryRun) {
        db.update(gttOrders)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(gttOrders.id, gtt.id))
          .run();
      }
      db.insert(agentLogs)
        .values({
          runId: state.runId,
          symbol: decision.symbol,
          action: "gtt_cancel",
          reasoning: decision.reasoning,
          dryRun,
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
          dryRun: isDryRunActive(),
          error: "gttParams missing in LLM decision",
          createdAt: now,
        })
        .run();
      continue;
    }

    if (decision.action === "gtt_modify" && decision.gttParams) {
      const gtt = findActiveGtt(decision.symbol);
      if (!gtt) {
        logger.warn("executeActions: no active GTT found for modify", {
          symbol: decision.symbol,
        });
        continue;
      }

      const holding = state.holdings.find((h) => h.tradingSymbol === decision.symbol);
      if (!holding) continue;

      const dryRun = isDryRunActive();
      if (!dryRun && !gtt.upstoxOrderId) {
        logger.error(
          "executeActions: active GTT row has no Upstox order ID — cannot modify remotely",
          {
            symbol: decision.symbol,
            gttId: gtt.id,
          },
        );
        db.insert(agentLogs)
          .values({
            runId: state.runId,
            symbol: decision.symbol,
            action: "gtt_modify_failed",
            reasoning: decision.reasoning,
            dryRun,
            error: "Active GTT row has no Upstox order ID — cannot modify remotely",
            createdAt: now,
          })
          .run();
        continue;
      }

      // The guard above guarantees upstoxOrderId is set whenever !dryRun; the `?? gtt.id`
      // fallback only fires in dry-run mode, where cancelGTT never touches the network and
      // the id is only used cosmetically in the "[DRY_RUN] would cancel" log string.
      const cancelResult = await getActiveBrokerClient().cancelTriggerOrder(
        gtt.upstoxOrderId ?? gtt.id,
        dryRun,
      );
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
            dryRun,
            error: cancelResult.error.message,
            createdAt: now,
          })
          .run();
        continue;
      }

      // Same reasoning as the gtt_cancel branch above: only mark the old row cancelled
      // when the cancel was real, so a dry-run "would cancel" doesn't make the agent
      // believe the still-live Upstox GTT is gone.
      if (!dryRun) {
        db.update(gttOrders)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(gttOrders.id, gtt.id))
          .run();
      }

      const newRequest = buildSlExitRequest(holding, decision.gttParams.newTriggerPrice);
      const newLimitPrice = Number(
        (decision.gttParams.newTriggerPrice * GTT_LIMIT_BUFFER).toFixed(2),
      );

      const createResult = await getActiveBrokerClient().createTriggerOrder(
        {
          ...newRequest,
          limitPrice: newLimitPrice,
        },
        dryRun,
      );

      if (createResult.ok) {
        db.insert(gttOrders)
          .values({
            id: crypto.randomUUID(),
            symbol: decision.symbol,
            type: "sl_exit",
            triggerPrice: decision.gttParams.newTriggerPrice,
            limitPrice: newLimitPrice,
            quantity: holding.quantity,
            status: dryRun ? "dry_run" : "active",
            approvalId: null,
            upstoxOrderId: dryRun ? null : createResult.value,
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
          dryRun,
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
      dryRun: isDryRunActive(),
      error: null,
      createdAt: new Date().toISOString(),
    })
    .run();

  return {};
}

/**
 * Build and return the Drishti agent StateGraph.
 * Nodes execute in order: fetchPortfolio → checkStopLoss → checkTargets → llmAnalyse → executeActions → logAndAlert.
 * Runs the full pipeline in one sequential pass — used by tests that assert on the
 * combined final state. Production ticks use buildFastAgentGraph/buildSlowAgentGraph
 * instead so a slow LLM analysis can never delay the next tick's SL/target checks.
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

/**
 * Build the fast, safety-critical phase of the pipeline: fetch portfolio state and
 * run SL/target detection. This must complete quickly and on every scheduled tick —
 * it gates the cron's isRunning guard, so nothing slow belongs in this graph.
 * @returns A configured StateGraph covering fetchPortfolio → checkStopLoss → checkTargets
 */
export function buildFastAgentGraph(): StateGraph {
  return new StateGraph()
    .addNode("fetchPortfolio", fetchPortfolioNode)
    .addNode("checkStopLoss", checkStopLossNode)
    .addNode("checkTargets", checkTargetsNode);
}

/**
 * Build the slow phase of the pipeline: LLM portfolio analysis and the GTT
 * modify/cancel/alert decisions it produces. Intended to run decoupled from the
 * cron's tick scheduling (see main.ts's tick()), continuing from the fast phase's
 * resulting state, so a long analysis call never blocks the next tick's SL/target
 * checks.
 * @returns A configured StateGraph covering llmAnalyse → executeActions → logAndAlert
 */
export function buildSlowAgentGraph(): StateGraph {
  return new StateGraph()
    .addNode("llmAnalyse", llmAnalyseNode)
    .addNode("executeActions", executeActionsNode)
    .addNode("logAndAlert", logAndAlertNode);
}

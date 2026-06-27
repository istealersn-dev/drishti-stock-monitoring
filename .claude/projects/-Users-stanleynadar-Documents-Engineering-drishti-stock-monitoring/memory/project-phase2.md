---
name: project-phase2
description: Phase 2 SL Watchdog — completed. What was built and key gotchas for Phase 3.
metadata:
  type: project
---

Phase 2 (SL Watchdog) is complete. All files pass typecheck, lint, and 22 unit tests.

**Why:** Auto-detect SL breaches and place GTT exit orders without user intervention.

**Files added:**
- `features/gtt/gtt.schema.ts` — Zod schemas for Upstox GTT API (v2 endpoints)
- `features/gtt/gtt.tools.ts` — createGTT, listGTTs, cancelGTT; DRY_RUN guard at call site
- `features/gtt/gtt.service.ts` — buildSlExitRequest (limit = trigger * 0.99)
- `features/gtt/gtt.test.ts`
- `features/stopLoss/stopLoss.config.ts` — loadSlConfigs() reads stock_config table
- `features/stopLoss/stopLoss.detector.ts` — detectBreaches() pure function; breach when LTP <= SL
- `features/stopLoss/stopLoss.handler.ts` — handleSlBreach: createGTT → write gtt_orders + agent_logs → Slack alert
- `features/stopLoss/stopLoss.test.ts` — detector tests (pure, no mocks)
- `features/stopLoss/stopLoss.handler.test.ts` — handler tests using vi.hoisted()
- `scheduler/cron.ts` — isMarketOpen(now?) + startCron(tick); fires only in market hours
- `main.ts` updated — tick() fetches holdings+LTP → detectBreaches → handleSlBreach each → Slack snapshot; cron started after first tick

**Key gotchas:**
- vi.mock() in vitest is hoisted — can't reference const/let vars from same scope inside factory. Use vi.hoisted() to define mock functions that are referenced in vi.mock factories.
- DRY_RUN checked at Upstox write call site (createGTT, cancelGTT), not at file top. SQLite writes always happen.
- gtt_orders row is written even in dry_run (SQLite write). agent_logs.dryRun=true captures it was simulated.
- Upstox GTT uses instrument_token field (matches holdings response field name).

**How to apply:** Phase 3 (buy approval flow) can import createGTT from gtt.tools.ts. The GTT schema uses transaction_type: "BUY" | "SELL" so buy entries are already supported at the schema level.

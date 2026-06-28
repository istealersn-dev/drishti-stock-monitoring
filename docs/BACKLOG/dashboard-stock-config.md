# Dashboard — Stock Config Screen

## Problem
No holding in `stock_config` has an SL/target configured. Without this, the LLM
only sees price vs average cost — it cannot reason about SL distance, target
proximity, or risk/reward. The autonomous SL exit logic also stays dormant.

## What to build
A screen in the React dashboard where the user can view all current holdings and
set or edit per-stock configuration.

## Fields per holding
- Stop-loss price (`sl_threshold`) — required for autonomous exit
- Target 1 price (`target_one`)
- Target 2 price (`target_two`)
- Target 2 open-ended flag (`target_two_open`) — e.g. "800+"
- Entry low / entry high (`entry_low`, `entry_high`)
- Buy price (`buy_price`)
- Active toggle (`is_active`)

## UX considerations
- Show alongside live LTP and current P&L so the user has context when setting SL
- Pre-populate `buy_price` from Upstox `average_price` if no config exists yet
- Inline edit — no separate form page, edit in-place per row
- Visual indicator on holdings that have no config yet (the most common initial state)
- Save should POST to a new API endpoint that upserts into `stock_config`

## API needed
`PUT /api/stock-config/:symbol` — upsert a row in `stock_config`
`GET /api/stock-config` — list all configured symbols (already likely exists for dashboard)

## Why it matters
Once at least `sl_threshold` is set for a holding, the SL watchdog activates for
that stock and the LLM gains the full context it needs for quality analysis.

# Database Explorer — Dashboard Screen

## Problem
The SQLite database (`drishti.db`) is the single source of truth for agent
decisions, GTT history, approval records, and logs — but there is no way to
inspect it without SSHing into the Mac Mini and using the CLI.

## What to build
A read-only database explorer tab in the React dashboard that surfaces the most
useful tables without exposing raw SQL to the user.

## Suggested views

### Agent Runs
Recent tick history: run ID, started at, status, summary. Useful for confirming
the agent is running on schedule and diagnosing missed ticks.

### Agent Logs
Per-symbol decision log: symbol, action taken, reasoning, dry-run flag, error if
any. Filterable by symbol and date. The primary audit trail for autonomous actions.

### GTT Orders
History of all GTT orders the agent has created or cancelled: symbol, type
(SL/BUY), trigger price, quantity, status, created at. Cross-reference with
Upstox GTT panel.

### Pending Approvals
Buy instructions awaiting or past approval: symbol, suggested qty, status
(pending/approved/rejected/timed_out), created and resolved timestamps.

### Stock Config
Same data as the stock config screen but read-only view for quick reference.

## UX considerations
- Tabs or sidebar navigation between table views
- Pagination — agent_logs grows fast, limit to 50 rows with load-more
- No write operations from this screen — read-only
- Timestamp columns should display in IST

## Why it matters
Currently the only way to audit what the agent did or why is to read raw PM2
logs. A dashboard view makes the system transparent and debuggable without
needing terminal access.

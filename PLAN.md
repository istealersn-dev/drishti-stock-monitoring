# PLAN.md — Drishti Build Plan

Drishti (दृष्टि — "watchful eye") is a hybrid autonomous stock monitoring and
trading agent. It runs entirely on a Mac Mini M4 Pro, uses a local LLM
(Gemma 4 E4B via Ollama), connects to Upstox for portfolio data and GTT order
management, and pushes all alerts, decisions, and approval requests to Slack.
A minimal local React dashboard acts as a control panel.

---

## Hybrid autonomy model

| Action | Mode | Mechanism |
|---|---|---|
| SL breach on existing holding | **Auto** | GTT exit placed immediately, Slack notified after |
| New buy instruction | **Approval required** | Slack interactive button — approve/reject |
| Entry GTT after approval | **Auto** | Placed on approve tap |
| T1 price hit | **Alert only** | Slack ping, user decides |
| T2 price hit | **Alert only** | Slack ping, user decides |
| Existing GTT modify/cancel | **Auto** (LLM-driven) | Slack notified after |
| Daily digest | **Auto** | 09:15 and 15:30 |

---

## Buy instruction format

Sent via Slack (alert channel or command channel) or UI dashboard input.

```
"Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
```

Parsed fields:
- `stockName` — free-text, resolved to Upstox trading symbol via search API
- `action` — always BUY for this flow (SELL handled autonomously via SL watchdog)
- `entryLow` / `entryHigh` — entry price range
- `stopLoss` — absolute SL price
- `targets` — `[680, 800]`; last item flagged `isOpenEnded: true` if suffixed with `+`
- `qty` — not in instruction; agent calculates from available cash/margin at midpoint entry

### Approval card (Slack Block Kit)

```
🟡 Buy Instruction — Awaiting Approval

Stock:   RAMCOSYS-EQ (Ramco Systems)
Action:  BUY
Entry:   ₹560 – ₹580  (GTT trigger at ₹580)
Stop loss: ₹520
Targets: T1 ₹680 (alert) · T2 ₹800+ (open, alert only)
Qty:     52 shares  (~₹30,160 at ₹580)
Margin:  ₹7,540 required (MTF)
Available margin: ₹48,200

[✅ Approve]   [❌ Reject]

Expires in 10 minutes. No action = auto-reject.
```

---

## Tech stack

### Runtime & language
| Tool | Version | Reason |
|---|---|---|
| Node.js | 22 LTS | Active LTS, native `fetch`, good ESM support |
| TypeScript | 5.8 | `strict` mode, latest inference improvements |
| pnpm | 9 | Workspace support for monorepo |
| tsx | latest | Zero-config TS execution for dev |

### Agent / LLM
| Tool | Version | Reason |
|---|---|---|
| LM Studio | latest | Local LLM runtime with OpenAI-compatible API, MLX-accelerated on Apple Silicon |
| Gemma 4 26B QAT | `google/gemma-4-26b-a4b-qat` | ~15GB at 4-bit QAT, tool-call support, ~9GB headroom on 24GB M4 Pro |
| LangGraph.js | 0.2.x | State machine for agentic loops, native tool-calling |
| @langchain/openai | latest | OpenAI-compatible adapter for LM Studio |

> **Model note:** Model: `google/gemma-4-26b-a4b-qat` via LM Studio.
> This is the QAT variant (~15GB at 4-bit) — safe on 24GB M4 Pro with ~9GB headroom.
> Do NOT switch to the standard BF16 26B — that requires 28GB and will swap.
> Cap context length at 8K for portfolio analysis prompts — 18 stocks fits comfortably
> in 4–8K tokens and the full 256K window eats unnecessary RAM.

### Broker integration
| Tool | Version | Reason |
|---|---|---|
| upstox-js-sdk | v3 | Official SDK — holdings, GTT, orders, LTP, symbol search |

### Notifications + approval
| Tool | Version | Reason |
|---|---|---|
| @slack/web-api | 7.x | Push alerts + interactive approval cards (Block Kit) |
| @slack/bolt | 3.x | Receive interactive button events (approve/reject) |

### Data persistence
| Tool | Version | Reason |
|---|---|---|
| better-sqlite3 | 11.x | Synchronous SQLite, fast, zero-config, local only |
| drizzle-orm | 0.30.x | Type-safe query builder, schema-as-code |
| drizzle-kit | 0.20.x | Migration CLI |

### Scheduler
| Tool | Version | Reason |
|---|---|---|
| node-cron | 3.x | Market-hours-aware polling jobs |

### Validation
| Tool | Version | Reason |
|---|---|---|
| zod | 3.x | Runtime schema validation for all external API responses |

### UI (control panel)
| Tool | Version | Reason |
|---|---|---|
| React | 19 | UI framework |
| Radix UI Primitive | 8.x | UI components |
| Vite | 7 | Build tool |
| TanStack Query | 5 | Data fetching + polling from agent REST API |
| TanStack Router | 1.x | Type-safe file-based routing |
| Recharts | 2.x | P&L and portfolio charts |
| Tailwind CSS | 4 | Utility styling |

### Code quality
| Tool | Version | Reason |
|---|---|---|
| ESLint | 9 | Flat config (`eslint.config.ts`) |
| @typescript-eslint/eslint-plugin | 8.x | TS-aware rules |
| eslint-plugin-import-x | latest | Import order, no cycles, no unresolved |
| eslint-plugin-unicorn | latest | Opinionated best practices |
| prettier | 3.x | Formatting via eslint-plugin-prettier |
| vitest | 2.x | Unit + integration tests |
| @vitest/coverage-v8 | 2.x | Coverage reports |

---

## Monorepo structure

```
drishti/
├── CLAUDE.md
├── PLAN.md
├── package.json                        # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.ts                    # ESLint v9 flat config (root)
├── .env                                # Gitignored
├── env.example
│
├── packages/
│   ├── agent/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── main.ts                 # Entry — starts Slack Bolt + cron + agent
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── portfolio/
│   │   │   │   │   ├── portfolio.tools.ts      # fetchHoldings, fetchLTP, fetchMargins
│   │   │   │   │   ├── portfolio.schema.ts     # Zod schemas
│   │   │   │   │   ├── portfolio.service.ts    # Business logic
│   │   │   │   │   └── portfolio.test.ts
│   │   │   │   │
│   │   │   │   ├── gtt/
│   │   │   │   │   ├── gtt.tools.ts            # createGTT, modifyGTT, cancelGTT, listGTTs
│   │   │   │   │   ├── gtt.schema.ts
│   │   │   │   │   ├── gtt.service.ts
│   │   │   │   │   └── gtt.test.ts
│   │   │   │   │
│   │   │   │   ├── stopLoss/
│   │   │   │   │   ├── stopLoss.config.ts      # Per-stock SL thresholds from DB
│   │   │   │   │   ├── stopLoss.detector.ts    # Breach detection
│   │   │   │   │   ├── stopLoss.handler.ts     # Auto GTT exit on breach
│   │   │   │   │   └── stopLoss.test.ts
│   │   │   │   │
│   │   │   │   ├── instructions/               # NEW — buy instruction pipeline
│   │   │   │   │   ├── instructions.parser.ts  # LLM parses natural language → ParsedInstruction
│   │   │   │   │   ├── instructions.schema.ts  # Zod: ParsedInstruction, ApprovalRequest
│   │   │   │   │   ├── instructions.resolver.ts # "Ramco Systems" → RAMCOSYS-EQ
│   │   │   │   │   ├── instructions.approval.ts # Build + send Slack approval card
│   │   │   │   │   ├── instructions.executor.ts # On approval: calc qty, create GTT
│   │   │   │   │   └── instructions.test.ts
│   │   │   │   │
│   │   │   │   ├── approval/                   # NEW — Slack interactive button handler
│   │   │   │   │   ├── approval.handler.ts     # Bolt action handler: approve / reject
│   │   │   │   │   ├── approval.store.ts       # Pending approvals in SQLite
│   │   │   │   │   ├── approval.timeout.ts     # Auto-reject after 10 minutes
│   │   │   │   │   └── approval.test.ts
│   │   │   │   │
│   │   │   │   ├── targets/                    # NEW — T1/T2 price monitoring
│   │   │   │   │   ├── targets.monitor.ts      # Watch LTP against T1/T2 per active trade
│   │   │   │   │   ├── targets.alert.ts        # Slack alert when T1 or T2 hit
│   │   │   │   │   └── targets.test.ts
│   │   │   │   │
│   │   │   │   ├── insights/
│   │   │   │   │   ├── insights.agent.ts       # LangGraph chain for LLM analysis
│   │   │   │   │   ├── insights.prompts.ts     # System + user prompt templates
│   │   │   │   │   └── insights.test.ts
│   │   │   │   │
│   │   │   │   ├── digest/
│   │   │   │   │   ├── digest.builder.ts
│   │   │   │   │   ├── digest.formatter.ts     # Slack Block Kit
│   │   │   │   │   └── digest.test.ts
│   │   │   │   │
│   │   │   │   └── alerts/
│   │   │   │       ├── alerts.slack.ts
│   │   │   │       ├── alerts.schema.ts
│   │   │   │       └── alerts.test.ts
│   │   │   │
│   │   │   ├── agent/
│   │   │   │   ├── drishtiAgent.ts             # LangGraph state machine
│   │   │   │   ├── agentState.ts
│   │   │   │   ├── agentTools.ts               # Tool registry
│   │   │   │   └── agent.test.ts
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrations/
│   │   │   │   └── db.ts
│   │   │   │
│   │   │   ├── llm/
│   │   │   │   └── llmClient.ts
│   │   │   │
│   │   │   ├── scheduler/
│   │   │   │   └── cron.ts
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── env.ts
│   │   │       ├── logger.ts
│   │   │       └── errors.ts
│   │   │
│   │   └── vitest.config.ts
│   │
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── routes/
│           │   ├── __root.tsx
│           │   ├── index.tsx               # Dashboard
│           │   ├── holdings.tsx            # Holdings + SL/target config
│           │   ├── instructions.tsx        # NEW — buy instruction input + pending approvals
│           │   ├── gtt.tsx                 # Active GTTs
│           │   ├── logs.tsx                # Agent decision audit log
│           │   └── settings.tsx            # Kill switch, dry-run, poll interval
│           ├── features/
│           │   ├── portfolio/
│           │   ├── gtt/
│           │   ├── instructions/           # NEW
│           │   ├── stopLoss/
│           │   └── settings/
│           └── shared/
│               ├── api.ts
│               └── components/
```

---

## ESLint v9 flat config

`eslint.config.ts` at repo root:

```ts
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import-x': importX,
      unicorn,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      'import-x/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import-x/no-cycle': 'error',
      'import-x/no-unresolved': 'error',

      'unicorn/filename-case': ['error', { case: 'camelCase' }],
      'unicorn/no-array-for-each': 'error',
      'unicorn/prefer-module': 'error',
      'unicorn/prevent-abbreviations': ['error', {
        allowList: { db: true, env: true, fn: true, props: true, ref: true },
      }],
    },
  },
  prettier,
  {
    ignores: ['dist/**', 'node_modules/**', 'packages/*/dist/**'],
  },
];
```

---

## SQLite schema (Drizzle)

```ts
export const stockConfig = sqliteTable('stock_config', {
  symbol:      text('symbol').primaryKey(),
  slThreshold: real('sl_threshold').notNull(),
  targetOne:   real('target_one'),
  targetTwo:   real('target_two'),
  targetTwoOpen: integer('target_two_open', { mode: 'boolean' }).default(false),
  entryLow:    real('entry_low'),
  entryHigh:   real('entry_high'),
  buyPrice:    real('buy_price'),
  isActive:    integer('is_active', { mode: 'boolean' }).default(true),
  updatedAt:   text('updated_at').notNull(),
});

export const pendingApprovals = sqliteTable('pending_approvals', {
  id:           text('id').primaryKey(),         // UUID, used as Slack action value
  symbol:       text('symbol').notNull(),
  parsedJson:   text('parsed_json').notNull(),   // JSON of ParsedInstruction
  suggestedQty: integer('suggested_qty').notNull(),
  status:       text('status').notNull(),        // 'pending' | 'approved' | 'rejected' | 'expired'
  slackTs:      text('slack_ts'),                // Slack message timestamp for update
  createdAt:    text('created_at').notNull(),
  resolvedAt:   text('resolved_at'),
});

export const gttOrders = sqliteTable('gtt_orders', {
  id:           text('id').primaryKey(),
  symbol:       text('symbol').notNull(),
  type:         text('type').notNull(),          // 'sl_exit' | 'buy_entry' | 'target'
  triggerPrice: real('trigger_price').notNull(),
  limitPrice:   real('limit_price').notNull(),
  quantity:     integer('quantity').notNull(),
  status:       text('status').notNull(),        // 'active' | 'triggered' | 'cancelled'
  approvalId:   text('approval_id'),             // FK to pendingApprovals if buy
  createdAt:    text('created_at').notNull(),
  updatedAt:    text('updated_at').notNull(),
});

export const agentLogs = sqliteTable('agent_logs', {
  id:        integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  runId:     text('run_id').notNull(),
  symbol:    text('symbol'),
  action:    text('action').notNull(),
  reasoning: text('reasoning'),
  dryRun:    integer('dry_run', { mode: 'boolean' }).notNull(),
  error:     text('error'),
  createdAt: text('created_at').notNull(),
});

export const agentRuns = sqliteTable('agent_runs', {
  id:          text('id').primaryKey(),
  startedAt:   text('started_at').notNull(),
  completedAt: text('completed_at'),
  status:      text('status').notNull(),         // 'running' | 'completed' | 'failed'
  summary:     text('summary'),
});
```

---

## Environment variables

```bash
# env.example

# Upstox
UPSTOX_API_KEY=
UPSTOX_API_SECRET=ecn2yu3371
UPSTOX_EXTENDED_TOKEN=                  # 1-year token — read-only calls
UPSTOX_ACCESS_TOKEN=                   # daily token — write calls (GTT)
UPSTOX_REDIRECT_URI=http://localhost:6318/callback
UPSTOX_NOTIFIER_WEBHOOK=https://drishti.stanleyj.dev/api/upstox/token

# LM Studio
LM_STUDIO_BASE_URL=http://localhost:1234
LM_MODEL=google/gemma-4-26b-a4b-qat   # exactly as LM Studio shows it

# Slack
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=                        # for Bolt socket mode
SLACK_ALERT_CHANNEL_ID=                 # alerts + digests
SLACK_COMMAND_CHANNEL_ID=              # buy instruction input channel

# Agent behaviour
DRISHTI_DRY_RUN=true
DRISHTI_POLL_INTERVAL_MINUTES=5
DRISHTI_MARKET_OPEN=09:15
DRISHTI_MARKET_CLOSE=15:30
DRISHTI_APPROVAL_TIMEOUT_MINUTES=10

# UI API
AGENT_API_PORT=4000
```

---

## Upstox token strategy

- **Extended token (1 year)** → used for all read-only calls:
  `fetchHoldings`, `fetchLTP`, `fetchPositions`, `getOrderBook`
- **Daily access token** → used only for write calls:
  `createGTT`, `cancelGTT`, `modifyGTT`
- **Semi-automated refresh** → agent triggers auth request at 08:45 AM,
  user approves via Upstox mobile notification,
  token delivered to `POST https://drishti.stanleyj.dev/api/upstox/token` (agent listener)
- No static IP required — personal developer app, well under 10 OPS
- Tunnel: `cloudflared tunnel run drishti` → `https://drishti.stanleyj.dev` → `localhost:4000`
  Tunnel ID: `ede69225-3e84-4ca1-a897-56632e2f9c7d`

---

## Agent state machine (LangGraph)

```
          ┌──────────────────┐
          │   START / POLL    │  ← cron every N minutes (market hours)
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐
          │  fetchPortfolio   │  holdings + LTP + margins + active GTTs
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐       ┌─────────────────────────┐
          │  checkStopLoss    │──YES─▶│ autoGTTExit + slackAlert│
          └────────┬─────────┘       └─────────────────────────┘
                   │ NO
          ┌────────▼─────────┐       ┌─────────────────────────┐
          │  checkTargets     │──HIT─▶│ slackAlert (T1 or T2)   │
          └────────┬─────────┘       └─────────────────────────┘
                   │ NO HIT
          ┌────────▼─────────┐
          │  llmAnalyse       │  Gemma 4 E4B reasons over full state
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐
          │  executeActions   │  GTT modify/cancel per LLM; never new buys
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐
          │  logAndAlert      │  SQLite + Slack
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐
          │       END         │  wait for next cron tick
          └──────────────────┘

  ┌───────────────────────────────────────────────────────┐
  │  PARALLEL: Slack Bolt listener (always running)        │
  │                                                        │
  │  message in command channel                            │
  │    → instructions.parser.ts  (LLM parse)              │
  │    → instructions.resolver.ts (symbol lookup)         │
  │    → instructions.approval.ts (Slack card + DB row)   │
  │                                                        │
  │  button tap: approve                                   │
  │    → instructions.executor.ts (calc qty, create GTT)  │
  │    → update pendingApprovals row                       │
  │    → Slack confirm message                             │
  │                                                        │
  │  button tap: reject                                    │
  │    → update pendingApprovals row → Slack confirm       │
  │                                                        │
  │  timeout (10 min, no tap)                              │
  │    → auto-reject → Slack notify                        │
  └───────────────────────────────────────────────────────┘
```

---

## LLM prompt design

### Instruction parser prompt

```
You are a financial instruction parser. Extract structured data from a
natural-language stock instruction. Output valid JSON only. No markdown.

Input examples:
  "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
  "Buy HDFCBANK 1600-1650 sl 1550 target 1800"
  "TATAMOTORS buy 780 SL 740 tgt 850 900+"

Output schema:
{
  "stockName": "string",
  "action": "BUY",
  "entryLow": number,
  "entryHigh": number,
  "stopLoss": number,
  "targets": [
    { "price": number, "isOpenEnded": boolean }
  ]
}

If entryLow === entryHigh (single price given), set both to that price.
If any required field is missing, set it to null.
```

### Portfolio analysis prompt

```
You are Drishti, an autonomous portfolio monitoring agent for Indian equities
on NSE/BSE via Upstox. You reason over a portfolio snapshot and decide what
actions to take on existing positions only.

Rules:
- You may only recommend: hold, gtt_modify, gtt_cancel, alert_only.
- Never recommend a new buy order. New buys come from user instructions only.
- Never recommend a market order.
- If a stop-loss breach has already been handled, do not duplicate the action.
- Be concise. 3–5 sentences per stock maximum.
- Output valid JSON only. No markdown, no preamble.

Output schema:
{
  "decisions": [
    {
      "symbol": "string",
      "action": "hold" | "gtt_modify" | "gtt_cancel" | "alert_only",
      "reasoning": "string",
      "gttParams": { ... } | null
    }
  ],
  "portfolioSummary": "string"
}
```

---

## Phase-by-phase build plan

---

### Phase 1 — Foundation

**Goal:** Repo boots, fetches holdings, pushes a Slack message, logs to SQLite.

**Tasks:**
1. Scaffold pnpm monorepo (`packages/agent`, `packages/ui`)
2. Configure `tsconfig.base.json` with `strict: true`, path aliases
3. Set up ESLint v9 flat config as specified above
4. Set up vitest in both packages
5. Implement `shared/env.ts` — typed env via Zod, fails fast on missing vars
6. Implement `shared/logger.ts` — structured JSON logger
7. Implement `db/schema.ts` + `db/db.ts` + first migration
8. Implement `llm/llmClient.ts` — `chat()` and `chatWithTools()` wrappers (LM Studio OpenAI-compatible API, base URL from `LM_STUDIO_BASE_URL`, model from `LM_MODEL`, max context 8K)
9. Implement `features/portfolio/portfolio.tools.ts` — `fetchHoldings`, `fetchLTP`
10. Implement `features/alerts/alerts.slack.ts` — `pushAlert(message)`
11. Wire `main.ts` — fetch holdings → format summary → push to Slack → log run

**Acceptance criteria:**
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test --run` passes
- [ ] `pnpm agent:dry` prints holdings and posts to Slack
- [ ] `agent_runs` table has one row after the run
- [ ] No GTT or order API calls are made

---

### Phase 2 — SL Watchdog (auto)

**Goal:** Agent detects SL breaches and places GTT exit orders automatically.

**Tasks:**
1. Implement `features/stopLoss/` — config, detector, handler
2. Implement `features/gtt/gtt.tools.ts` — `createGTT`, `listGTTs`, `cancelGTT`
3. Implement `features/gtt/gtt.schema.ts` — Zod schemas for Upstox GTT responses
4. Implement `scheduler/cron.ts` — market-hours polling
5. Add `DRY_RUN` guard at every Upstox write call site
6. Log all GTT actions to `gtt_orders` and `agent_logs`

**Acceptance criteria:**
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass
- [ ] Simulated SL breach with `DRY_RUN=true` logs intended GTT, makes no API call
- [ ] Slack receives correctly formatted SL breach alert
- [ ] `gtt_orders` row written with `type: 'sl_exit'`
- [ ] Cron only fires between market open and close

---

### Phase 3 — Buy Instruction Pipeline + Approval Flow

**Goal:** User sends a buy instruction → agent parses → Slack approval card →
on approve, GTT buy entry is created.

**Tasks:**
1. Implement `features/instructions/instructions.parser.ts` — LLM parses natural language
2. Implement `features/instructions/instructions.schema.ts` — `ParsedInstruction` Zod type
3. Implement `features/instructions/instructions.resolver.ts` — stock name → Upstox symbol
4. Implement `features/instructions/instructions.approval.ts` — build + send Slack Block Kit card
5. Implement `features/approval/approval.store.ts` — write/read `pending_approvals` table
6. Implement `features/approval/approval.handler.ts` — Bolt action: approve → executor, reject → close
7. Implement `features/approval/approval.timeout.ts` — auto-reject after `DRISHTI_APPROVAL_TIMEOUT_MINUTES`
8. Implement `features/instructions/instructions.executor.ts`:
   - Fetch available margin
   - Calculate qty at midpoint entry price
   - Create GTT buy entry at `entryHigh`
   - Write `gtt_orders` row with `type: 'buy_entry'`, `approvalId`
   - Write SL threshold to `stock_config`
   - Write T1/T2 to `stock_config`
9. Start Bolt in socket mode alongside cron in `main.ts`
10. Accept instructions from both `SLACK_ALERT_CHANNEL_ID` and `SLACK_COMMAND_CHANNEL_ID`

**Acceptance criteria:**
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass
- [ ] Parser correctly extracts all fields from canonical format
- [ ] Parser handles: single price entry, missing T2, `800+` open-ended T2, unrecognised stock
- [ ] Approval card posts to Slack with correct fields and two buttons
- [ ] `DRY_RUN=true`: approval card posts but no GTT API call on approve
- [ ] Reject: `pending_approvals` row updated, Slack card updated with "Rejected"
- [ ] Timeout: after 10 min no tap, row set to `expired`, Slack card updated
- [ ] `gtt_orders` and `stock_config` rows written correctly on approve

---

### Phase 4 — LangGraph Agent Loop

**Goal:** Full agentic loop for existing position management.

**Tasks:**
1. Implement `agent/agentState.ts` — `AgentState` type
2. Implement `agent/agentTools.ts` — LangGraph tool registry
3. Implement `agent/drishtiAgent.ts` — `StateGraph` with all nodes
4. Implement `features/targets/` — T1/T2 price monitor + alert
5. Implement `features/insights/` — LLM chain, Zod-validate output
6. Connect agent output → `executeActions` (modify/cancel only) → Slack
7. Implement `agentRuns` tracking

**Acceptance criteria:**
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass
- [ ] Agent runs end-to-end with mocked Upstox responses in test
- [ ] LLM cannot output `action: "buy"` — Zod schema rejects it
- [ ] Invalid LLM output → fallback to `alert_only`
- [ ] T1 hit → Slack alert, no auto-action
- [ ] T2 hit → Slack alert, no auto-action
- [ ] Every decision logged to `agent_logs` with reasoning

---

### Phase 5 — Digest + REST API

**Goal:** Daily digests + REST API layer for the UI.

**Tasks:**
1. Implement `features/digest/` — morning and closing Slack digest
2. Add cron jobs at 09:15 and 15:30
3. Implement REST API (`/api/runs`, `/api/holdings`, `/api/gtt`,
   `/api/logs`, `/api/settings`, `/api/approvals`)
4. Add MTF interest burn-rate tracker in digest

**Acceptance criteria:**
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass
- [ ] Morning and closing digests post at correct times
- [ ] All REST API routes return typed JSON
- [ ] `/api/approvals` returns pending approvals with parsed instruction data

---

### Phase 6 — Control Panel UI

**Goal:** Local React dashboard at `localhost:5173`.

**Tasks:**
1. Scaffold `packages/ui` — Vite + React 19 + Tailwind 4 + TanStack Router
2. TanStack Query → agent REST API, 30s polling
3. Dashboard — portfolio summary cards + P&L chart
4. Holdings — table with inline SL/target edit
5. Instructions — NEW: text input for buy instruction + pending approvals list
6. GTT — active GTTs with cancel
7. Logs — audit log with reasoning expanded on click
8. Settings — dry-run toggle, pause, poll interval

**Acceptance criteria:**
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass across both packages
- [ ] Instructions page: input field accepts canonical format, posts to agent,
      pending approval appears in list below
- [ ] Approve/reject on pending approvals list sends correct API call
- [ ] SL threshold edit persists to SQLite and is picked up on next agent poll
- [ ] Dry-run toggle immediately reflects in agent
- [ ] No console errors in browser

---

## Guardrails summary

| Guardrail | Mechanism |
|---|---|
| No market orders | No market order function exists in `gtt.tools.ts` |
| No auto-buys | LLM prompt schema rejects `action: "buy"` via Zod |
| Buy requires approval | `approval.handler.ts` is the only path to `instructions.executor.ts` |
| Approval timeout | Auto-reject after `DRISHTI_APPROVAL_TIMEOUT_MINUTES` |
| Dry-run | Checked at every Upstox write call site |
| LLM output validation | Zod parse before any action; invalid → `alert_only` fallback |
| No cloud LLM | `llmClient.ts` points to `LM_STUDIO_BASE_URL` (localhost only) |
| Import cycles | `import-x/no-cycle` ESLint rule |
| Secrets never committed | `.env` in `.gitignore` |

---

## First commands for Claude Code

```bash
mkdir drishti && cd drishti
git init
pnpm init
echo "packages:\n  - packages/*" > pnpm-workspace.yaml

# Pull and verify the model
ollama pull gemma4:e4b
ollama run gemma4:e4b "Reply with JSON only: {\"status\": \"ok\"}"

# Start Phase 1
# Read CLAUDE.md, then scaffold per the structure above
```
| Docs are reference only | Values from `docs/` never hardcoded — DB is source of truth |
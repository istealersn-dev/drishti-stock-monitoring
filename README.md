# Drishti — दृष्टि

> **Watchful eye.** A hybrid autonomous stock monitoring and trading agent for the Indian market.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-deployed-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/license-private-lightgrey)](.)

Drishti runs entirely on a Mac Mini M4 Pro. It monitors an Upstox portfolio, manages GTT orders, fires stop-loss exits autonomously, and requires explicit Slack approval before placing any new buy. A React dashboard deployed on Cloudflare Pages acts as a remote control panel; the agent and LLM run locally.

---

## Autonomy model

| Action | Mode | Mechanism |
|---|---|---|
| SL breach on existing holding | **Auto** | GTT exit placed immediately, Slack notified after |
| New buy instruction | **Approval required** | Slack interactive card — approve / reject |
| Entry GTT after approval | **Auto** | Placed on approve tap |
| T1 price hit | **Alert only** | Slack ping, user decides |
| T2 price hit | **Alert only** | Slack ping, user decides |
| Existing GTT modify / cancel | **Auto** (LLM-driven) | Slack notified after |
| Daily digest | **Auto** | 09:15 and 15:30 IST |

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript 5.8 strict |
| Agent | LangGraph.js, LM Studio (local LLM via OpenAI-compatible API) |
| LLM | `google/gemma-4-26b-a4b-qat` — QAT 4-bit, ~15 GB, MLX-accelerated |
| Broker API | Upstox v3 (GTT orders, portfolio, margins) |
| Alerts | Slack Bolt (Socket Mode) — alerts + interactive approval cards |
| API server | Fastify 5 |
| Database | SQLite via Drizzle ORM — single file, no external dependencies |
| UI | React 19, TanStack Router, TanStack Query, Tailwind CSS 4 |
| UI hosting | Cloudflare Pages |
| Monorepo | pnpm workspaces |

---

## Project structure

```
drishti/
├── packages/
│   ├── agent/               # Node.js backend — agent, API, scheduler, Slack
│   │   └── src/
│   │       ├── features/
│   │       │   ├── portfolio/       # Holdings, LTP, margins
│   │       │   ├── gtt/             # Create / modify / cancel GTT orders
│   │       │   ├── stopLoss/        # SL breach detection + auto exit
│   │       │   ├── instructions/    # Buy instruction parser + approval pipeline
│   │       │   ├── approval/        # Slack interactive button handler
│   │       │   ├── targets/         # T1 / T2 price monitoring + alerts
│   │       │   ├── insights/        # LLM portfolio analysis (LangGraph)
│   │       │   ├── digest/          # Morning / EOD digest builder
│   │       │   ├── alerts/          # Slack alert formatter
│   │       │   └── slack-commands/  # !status, !pnl, !holdings, !gtts, !analyse
│   │       ├── api/                 # Fastify REST API (used by UI)
│   │       ├── llm/                 # LM Studio client (OpenAI-compatible)
│   │       ├── db/                  # Drizzle schema + migrations
│   │       ├── scheduler/           # node-cron market-hours polling
│   │       └── shared/              # env, logger, errors
│   └── ui/                  # React dashboard — Cloudflare Pages
│       └── src/
│           ├── pages/               # Holdings, GTT, Instructions, Logs, Settings
│           └── lib/                 # API client, auth (X-Access-Key)
├── wrangler.toml            # Cloudflare Pages config
├── env.example              # All required env vars with placeholders
└── PLAN.md                  # Full build plan and acceptance criteria
```

---

## Buy instruction format

Instructions are sent in natural language from Slack or the UI dashboard:

```
Ramco Systems Buy 560-580 SL 520 Tgt 680 800+
```

The agent parses this into a structured approval card sent to Slack:

```
🟡 Buy Instruction — Awaiting Approval

Stock:    RAMCOSYS-EQ (Ramco Systems)
Action:   BUY
Entry:    ₹560 – ₹580  (GTT trigger at ₹580)
Stop loss: ₹520
Targets:  T1 ₹680 (alert) · T2 ₹800+ (open, alert only)
Qty:      52 shares  (~₹30,160 at ₹580)

[✅ Approve]   [❌ Reject]

Expires in 10 minutes. No action = auto-reject.
```

---

## Getting started

### Prerequisites

- Node.js 22 LTS, pnpm 9
- [LM Studio](https://lmstudio.ai/) running locally with `google/gemma-4-26b-a4b-qat` loaded
- Upstox developer account with API credentials
- Slack app with Socket Mode enabled (Bot + App tokens)

### Setup

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp env.example .env

# Run database migrations
pnpm db:migrate

# Start the agent (dry-run safe — no real orders placed)
pnpm agent:dry

# Start the UI in dev mode
pnpm dev:ui
```

### Environment variables

| Variable | Description |
|---|---|
| `LM_STUDIO_BASE_URL` | LM Studio server URL (default: `http://localhost:1234`) |
| `LM_MODEL` | Model ID loaded in LM Studio |
| `UPSTOX_API_KEY` | Upstox app API key |
| `UPSTOX_API_SECRET` | Upstox app API secret |
| `UPSTOX_ACCESS_TOKEN` | OAuth access token (refresh daily) |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token (`xoxb-…`) |
| `SLACK_APP_TOKEN` | Slack app-level token for Socket Mode (`xapp-…`) |
| `SLACK_SIGNING_SECRET` | Slack signing secret |
| `SLACK_ALERT_CHANNEL_ID` | Channel ID for alerts and approval cards |
| `SLACK_COMMAND_CHANNEL_ID` | Channel ID for `!` commands |
| `DRISHTI_DRY_RUN` | `true` skips all Upstox write calls — logs instead |
| `DRISHTI_ACCESS_KEY` | Secret key for UI → API authentication |
| `AGENT_API_PORT` | REST API port (default: `4000`) |

See `env.example` for the full list.

---

## Commands

```bash
pnpm dev          # Start backend agent (tsx watch)
pnpm dev:ui       # Start React dashboard (Vite, port 5173)
pnpm build        # Build both packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm lint         # ESLint across all packages
pnpm test         # Vitest across all packages
pnpm db:migrate   # Run pending SQLite migrations
pnpm agent:dry    # Start agent with DRISHTI_DRY_RUN=true
```

---

## UI deployment (Cloudflare Pages)

The React dashboard is hosted on Cloudflare Pages. The agent API runs locally and is **never** exposed publicly — the UI authenticates via `X-Access-Key` header.

Set `VITE_API_BASE_URL` as a build-time environment variable in the CF Pages dashboard (e.g. `https://drishti.yourdomain.dev`) before deploying. The Vite dev proxy (`/api → localhost:4000`) is used for local development.

---

## Non-negotiables

- **No market orders.** GTT orders only — no market order function exists in the codebase.
- **No buy without approval.** The Slack approval flow is mandatory. If unavailable, abort and alert.
- **`DRISHTI_DRY_RUN` is checked at the call site** for every Upstox write — not at startup.
- **Local LLM only.** No calls to OpenAI, Anthropic, or any cloud AI API.
- **SQLite only.** No Postgres, Redis, or external data store.

---

*Private repository — not for distribution.*

# PLAN-ADVISOR.md — Drishti Phase 7: Personal AI SEBI Advisor

Evolves Drishti from a monitoring/execution bot into a proactive personal
investment advisor with SEBI-grade reasoning — all still local, no cloud LLM.

---

## What changes (and what doesn't)

**Stays the same:**
- LM Studio / Gemma 4 QAT local LLM, 8K context cap
- SQLite only, no external data stores
- All write calls behind DRY_RUN guard
- Approval flow for new buys
- No market orders

**New capabilities:**
| Capability | Input | Output |
|---|---|---|
| Advisory conversation | Natural language question (Slack / UI) | SEBI-adviser-quality response |
| Trade setup generator | Stock name | Entry range, SL at technical level, T1/T2 at ≥1:2 R:R |
| Pre-trade validator | ParsedInstruction | PASS / FAIL with reason (R:R, sector cap) |
| Portfolio health engine | Scheduled + on-demand | Capital at risk, MTF burn rate, concentration map |
| Technical levels | Symbol | 50/200 DMA, 52w H/L, recent swing H/L from Upstox OHLCV |
| Watchlist proximity alert | Morning digest | Flags watchlist stocks within 2% of key DMA support |

---

## New feature folders

```
features/
├── technicals/
│   ├── technicals.service.ts      # Upstox historical OHLCV → compute DMAs, swing levels
│   ├── technicals.schema.ts       # Zod: OHLCVBar, TechnicalLevels
│   ├── technicals.cache.ts        # Read/write technical_levels SQLite table
│   └── technicals.test.ts
│
├── advisor/
│   ├── advisor.chain.ts           # LangGraph chain: build context → SEBI prompt → parse response
│   ├── advisor.prompts.ts         # SEBI system prompt + context-building helpers
│   ├── advisor.slack.ts           # Slack message handler: detect advisory question, respond
│   ├── advisor.schema.ts          # Zod: AdvisoryRequest, AdvisoryResponse
│   └── advisor.test.ts
│
├── health/
│   ├── health.engine.ts           # Compute portfolio metrics (capital at risk, MTF burn, sector map)
│   ├── health.formatter.ts        # Slack Block Kit health digest card
│   ├── health.schema.ts           # Zod: PortfolioHealthReport
│   └── health.test.ts
│
├── watchlist/
│   ├── watchlist.service.ts       # CRUD for watchlist table
│   ├── watchlist.monitor.ts       # Cross-ref LTP vs DMA levels, emit proximity alert
│   ├── watchlist.schema.ts
│   └── watchlist.test.ts
│
└── validator/
    ├── validator.rr.ts            # R:R check: (T1 - entryHigh) / (entryHigh - SL) ≥ 2.0
    ├── validator.sector.ts        # Sector concentration check: adding position stays ≤ 25%
    ├── validator.schema.ts        # Zod: ValidationResult
    └── validator.test.ts
```

---

## New DB tables

```ts
// Add to db/schema.ts

export const technicalLevels = sqliteTable('technical_levels', {
  symbol:       text('symbol').notNull(),
  date:         text('date').notNull(),          // YYYY-MM-DD of last close
  dma50:        real('dma50'),
  dma200:       real('dma200'),
  weekHigh52:   real('week_high_52'),
  weekLow52:    real('week_low_52'),
  swingHigh:    real('swing_high'),              // most recent swing high (20-bar)
  swingLow:     real('swing_low'),               // most recent swing low (20-bar)
  avgVolume20:  real('avg_volume_20'),
  updatedAt:    text('updated_at').notNull(),
}, (t) => ({
  pk: primaryKey(t.symbol, t.date),
}));

export const watchlist = sqliteTable('watchlist', {
  symbol:      text('symbol').primaryKey(),
  displayName: text('display_name').notNull(),
  notes:       text('notes'),
  addedAt:     text('added_at').notNull(),
});

export const advisoryConversations = sqliteTable('advisory_conversations', {
  id:        text('id').primaryKey(),           // UUID
  sessionId: text('session_id').notNull(),      // groups a Q&A exchange
  role:      text('role').notNull(),            // 'user' | 'assistant'
  content:   text('content').notNull(),
  channel:   text('channel').notNull(),         // 'slack' | 'ui'
  createdAt: text('created_at').notNull(),
});
```

---

## Advisory conversation flow

Triggered **only** by explicit slash command: `/drishti ask <question>`

```
User (Slack): /drishti ask Should I add to HDFCBANK at these levels?
                            │
               slackCommands.router.ts routes to handleAsk(query)
               (no catch-all — only explicit /drishti ask triggers this)
                            │
               advisor.chain.ts builds context:
               - current holdings (portfolio.service)
               - HDFCBANK technical levels (technicals.cache)
               - sector allocation summary (health.engine)
               - recent agent_logs for HDFCBANK
               ↓
               SEBI system prompt + context + question → LLM
               ↓
               Validate: response is non-empty string
               ↓
               Post to Slack as plain text
               Log to advisory_conversations
```

**Routing rules** — no catch-all, no response to unrecognised messages:
- `/drishti ask <question>` → advisory chain
- `/drishti setup <stock>` → trade setup generator
- `/drishti health` → portfolio health report
- All other `/drishti` subcommands → existing handlers
- `app.message` listener: unchanged — only responds to `!` prefixed commands

---

## Trade setup generator

Triggered by Slack: `/drishti setup HDFCBANK`

```
1. Resolve "HDFCBANK" → HDFCBANK-EQ (instructions.resolver)
2. Fetch last 200 trading days OHLCV (technicals.service → Upstox historical API)
3. Compute: dma50, dma200, swingLow (20-bar), swingHigh (20-bar), avgVolume20
4. Build setup prompt:
   "Given these technical levels for HDFCBANK-EQ, suggest an entry range,
    SL at the most significant support level below entry, and T1/T2 at ≥1:2 R:R.
    Entry must be above dma200. SL must be at prior swing low or dma200.
    Output JSON only: { entryLow, entryHigh, stopLoss, targets: [{price, isOpenEnded}] }"
5. LLM output → Zod validate
6. Run pre-trade validator (R:R check)
7. Post setup card to Slack — pre-fills as a buy instruction
   User can approve directly or modify and repost
```

---

## Pre-trade validator (plugged into existing approval pipeline)

Insert between `instructions.resolver` and `instructions.approval`:

```ts
// validator.rr.ts
function validateRiskReward(instruction: ParsedInstruction): ValidationResult {
  const entry = (instruction.entryLow + instruction.entryHigh) / 2;
  const risk = entry - instruction.stopLoss;
  const t1 = instruction.targets[0]?.price;
  if (!t1) return { pass: false, reason: 'No T1 specified.' };
  const reward = t1 - entry;
  const ratio = reward / risk;
  if (ratio < 2.0) {
    return {
      pass: false,
      reason: `R:R is 1:${ratio.toFixed(1)}, minimum required is 1:2. Raise T1 or tighten SL.`,
    };
  }
  return { pass: true };
}

// validator.sector.ts
async function validateSectorConcentration(symbol: string): Promise<ValidationResult> {
  // Look up sector for symbol from stock_config or a sector map
  // Sum existing holdings in same sector as % of total portfolio value
  // If adding midpoint-entry * suggestedQty would push sector > 25%, fail
}
```

If either fails, abort before posting Slack card. Post failure reason to Slack instead:
```
❌ Trade Rejected — Pre-trade Check Failed

Stock:  HDFCBANK-EQ
Reason: R:R is 1:1.3 — minimum required is 1:2. Raise T1 to ₹1,820 or tighten SL.
```

---

## Portfolio health engine

Scheduled: every Sunday 10:00 IST + on-demand via `/drishti health`

```ts
type PortfolioHealthReport = {
  totalCapitalAtRisk: number;        // sum of (currentLtp - sl) * qty for all active positions
  capitalAtRiskPct: number;          // as % of total portfolio value
  mtfBurnRateMonthly: number;        // sum of MTF positions * 18% / 12
  sectorAllocation: Record<string, number>; // sector → % of portfolio
  overdueForReview: string[];        // symbols held > 30 days with no SL trail
  concentrationWarnings: string[];   // any sector > 20% (warn) or > 25% (critical)
  underperformers: Array<{           // holdings below buy price by > 5%
    symbol: string;
    buyPrice: number;
    currentLtp: number;
    pctDown: number;
  }>;
  llmNarrative: string;              // SEBI-style 3–5 sentence portfolio assessment
};
```

---

## Technical levels (Upstox historical data API)

```ts
// technicals.service.ts

// Upstox endpoint: GET /v3/historical-candle/{instrument_key}/{unit}/{to_date}/{from_date}
// unit: 'day', from_date: 200 trading days ago, to_date: today

async function fetchAndComputeLevels(symbol: string): Promise<TechnicalLevels> {
  const bars = await fetchOHLCV(symbol, 200); // 200 daily bars
  return {
    dma50:       avg(bars.slice(-50).map(b => b.close)),
    dma200:      avg(bars.map(b => b.close)),
    weekHigh52:  Math.max(...bars.map(b => b.high)),
    weekLow52:   Math.min(...bars.map(b => b.low)),
    swingHigh:   swingHigh(bars.slice(-20)),
    swingLow:    swingLow(bars.slice(-20)),
    avgVolume20: avg(bars.slice(-20).map(b => b.volume)),
  };
}
```

Cache in `technical_levels` table. Refresh once per day at 16:00 IST (after market close).
Cron: `0 16 * * 1-5` (weekdays only).

---

## Watchlist proximity alert (morning digest addition)

In `digest.builder.ts`, after existing portfolio summary:

```ts
for (const stock of watchlistStocks) {
  const levels = await getTechnicalLevels(stock.symbol);
  const ltp = await fetchLTP(stock.symbol);
  const distFromDma200 = (ltp - levels.dma200) / levels.dma200;
  if (distFromDma200 < 0.02) {
    // within 2% of 200 DMA — flag as potential entry
    alerts.push(`📍 ${stock.displayName} is trading within 2% of 200 DMA (₹${levels.dma200.toFixed(0)}). LTP: ₹${ltp}`);
  }
}
```

---

## SEBI advisor system prompt

The system prompt the user provided becomes `advisor.prompts.ts`:

```ts
export const SEBI_ADVISOR_SYSTEM_PROMPT = `
You are a SEBI-registered investment advisor and senior portfolio manager with
15+ years of experience... [full prompt as provided]
`;

export function buildAdvisoryContext(params: {
  question: string;
  portfolio: PortfolioSnapshot;
  relevantLevels: TechnicalLevels[];
  sectorAllocation: Record<string, number>;
  recentLogs: AgentLog[];
}): string {
  // Build concise context block under 6K tokens
  // Question gets 2K budget; portfolio state gets 3K; technicals get 1K
}
```

---

## New UI routes

```
/advisor     — Chat interface with Drishti (TanStack Query, WebSocket or polling)
/watchlist   — Add/remove watchlist stocks, see proximity status
/health      — Portfolio health dashboard: risk gauge, sector pie, MTF burn counter
```

---

## New REST API endpoints

```
GET  /api/advisor/conversations          → recent advisory exchanges
POST /api/advisor/ask                    → submit question, returns response
GET  /api/advisor/setup/:symbol          → generate trade setup for symbol

GET  /api/watchlist                      → list watchlist stocks + LTP + DMA proximity
POST /api/watchlist                      → add stock
DELETE /api/watchlist/:symbol            → remove stock

GET  /api/health                         → latest PortfolioHealthReport
POST /api/health/run                     → trigger on-demand health run
```

---

## Phase 7 tasks (ordered)

### 7.1 — Technical levels infrastructure
1. `technicals.schema.ts` — Zod for OHLCV bar + TechnicalLevels
2. `technicals.service.ts` — fetch 200-day OHLCV from Upstox historical API
3. `technicals.cache.ts` — read/write `technical_levels` SQLite table
4. Add `technical_levels` table to `db/schema.ts` + migration
5. Add daily 16:00 cron job to refresh levels for all active holdings + watchlist
6. `technicals.test.ts`

### 7.2 — Pre-trade validator
7. `validator.rr.ts` — R:R validation
8. `validator.sector.ts` — sector concentration check
9. Plug into `instructions.pipeline.ts` between resolver and approval
10. `validator.test.ts` — test pass/fail cases including sector cap

### 7.3 — Watchlist
11. `watchlist` table migration
12. `watchlist.service.ts` — CRUD
13. `watchlist.monitor.ts` — proximity check against `technical_levels`
14. REST endpoints: `GET/POST/DELETE /api/watchlist`
15. Morning digest update in `digest.builder.ts`
16. `watchlist.test.ts`

### 7.4 — Portfolio health engine
17. `health.engine.ts` — compute all metrics
18. `health.formatter.ts` — Slack Block Kit card
19. Sunday 10:00 cron + `/drishti health` Slack command
20. REST endpoint: `GET /api/health`, `POST /api/health/run`
21. `health.test.ts`

### 7.5 — Advisory conversation
22. `advisor.prompts.ts` — SEBI system prompt + context builder
23. `advisor.chain.ts` — LangGraph chain
24. `advisor.slack.ts` — intent detection + Slack handler
25. `advisoryConversations` table migration
26. REST endpoints: `GET /api/advisor/conversations`, `POST /api/advisor/ask`
27. `advisor.test.ts`

### 7.6 — Trade setup generator
28. `advisor.chain.ts` — add setup sub-chain
29. Slack: `/drishti setup <stock>` command handler
30. REST endpoint: `GET /api/advisor/setup/:symbol`
31. Setup Slack card with pre-filled buy instruction
32. Test with mocked OHLCV + mocked LLM

### 7.7 — UI additions
33. `/watchlist` route — add/remove, show DMA proximity
34. `/health` route — risk gauge, sector allocation pie, MTF burn
35. `/advisor` route — chat interface, polling `GET /api/advisor/conversations`

---

## Acceptance criteria (Phase 7 complete)

- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test --run` pass
- [ ] `/drishti setup HDFCBANK` posts a trade setup card in Slack with valid R:R
- [ ] Buy instruction with R:R < 1:2 is rejected before Slack card is posted
- [ ] Buy instruction that would push sector > 25% posts a concentration warning
- [ ] Advisory question ("Should I hold AXISBANK?") gets a SEBI-quality response citing specific levels
- [ ] Portfolio health runs Sunday 10:00, posts to Slack
- [ ] Watchlist proximity alert appears in morning digest when stock is within 2% of DMA200
- [ ] `technical_levels` table updated daily at 16:00 for all active holdings + watchlist
- [ ] All new tool functions have unit tests with mocked Upstox responses
- [ ] No cloud LLM calls anywhere (LM Studio only)
- [ ] Context passed to LLM never exceeds 8K tokens (assert in tests)

---

## Constraints and guardrails added

| Guardrail | Mechanism |
|---|---|
| R:R ≥ 1:2 enforced | `validator.rr.ts` blocks approval card if ratio < 2.0 |
| Sector cap 25% | `validator.sector.ts` warns / blocks before approval |
| Advisory ≠ order | `advisor.chain.ts` output is text only — no action schema |
| LLM context cap | `buildAdvisoryContext` enforces 6K token budget before calling LLM |
| Technical data freshness | Cache TTL enforced — stale if `updatedAt` > 1 trading day |
| No speculative buys | Trade setup posts as approval card — user still taps Approve |

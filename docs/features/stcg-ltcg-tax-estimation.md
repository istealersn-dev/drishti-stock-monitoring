# Feature Plan: STCG/LTCG Tax Estimation for Ask Drishti

## Problem

The "Ask Drishti" suggestion grid advertises a tax-aware question — *"Estimate my STCG vs LTCG if I
exit my three largest positions today"* — that the current implementation cannot actually answer
correctly:

- `fetchHoldings()` (`packages/agent/src/features/portfolio/portfolio.tools.ts`) hits
  `/v2/portfolio/long-term-holdings`, which returns only aggregate `quantity` and a blended
  `average_price` per ISIN — **no acquisition date, no per-lot breakdown**.
- `SEBI_ADVISOR_SYSTEM_PROMPT` (`packages/agent/src/features/advisor/advisor.prompts.ts`) contains no
  capital-gains tax rules, rates, or exemption thresholds.

Without a holding period, STCG (<12 months) vs LTCG (≥12 months) classification for equity is
impossible to do correctly — the model would have to guess, which conflicts with its own persona
rule ("if you don't have enough to form a view, say so").

## Data source

Upstox's **Get Historical Trades API** (`GET /v2/charges/historical-trades`) provides what's missing:
per-trade `trade_date`, `quantity`, `price`, transaction type (`BUY`/`SELL`), and `isin`. Confirmed via
Upstox's own docs. Limitation: **only the last 3 financial years** of trade history are returned.

This is not a blocker for classification — anything absent from a 3-year lookback is, by definition,
older than the 12-month STCG/LTCG threshold, so those lots can safely default to LTCG using the
holding's existing blended `average_price` as an approximate cost basis.

Known, currently-unaddressed wrinkle: the **Jan 31, 2018 grandfathering rule** floors LTCG cost basis
at the Jan 31, 2018 fair market value for shares bought before that date. This API can't help resolve
that either way — v1 will not implement grandfathering and must say so explicitly wherever a tax
estimate is shown, rather than silently producing a number that ignores it.

## Design

### 1. New Upstox tool — `fetchHistoricalTrades`

`packages/agent/src/features/portfolio/portfolio.tools.ts`, following the existing `fetchHoldings` /
`fetchLTP` pattern exactly: `fetch` → check `response.ok` → `safeParse` through a new Zod schema
(`HistoricalTradesResponseSchema` in `portfolio.schema.ts`) → `Result<Trade[], UpstoxError>`. Query
params: `segment=EQ`, `start_date`/`end_date` (default: earliest allowed within the 3-year window to
today), paginated per Upstox's documented page size.

### 2. FIFO lot reconciliation — pure logic module

New file, e.g. `packages/agent/src/features/tax/tax.reconciliation.ts`. Pure function, no I/O, fully
unit-testable:

```ts
function reconcileLots(trades: Trade[], asOf: Date): { stcgQty: number; stcgCostBasis: number; ltcgQty: number; ltcgCostBasis: number }
```

Algorithm: sort trades by date ascending per ISIN, replay BUYs as a FIFO queue of lots, consume lots
via SELLs (oldest lot first — matches how Indian tax law allocates disposals), classify whatever
remains as of `asOf` into STCG/LTCG buckets by comparing each remaining lot's trade date against the
12-month cutoff.

Edge cases to cover in tests:
- All lots within the 3-year window (fully reconcilable).
- Holding quantity exceeds what 3 years of trade history can account for (remainder defaults to LTCG
  at the holding's blended `average_price`).
- A sell that partially consumes a lot (partial-lot remainder must carry its original buy date).
- A lot exactly at the 365-day boundary (needs an explicit, tested decision on which side it falls).

### 3. Tax rate constants — config, not hardcoded prompt text

New `packages/agent/src/features/tax/tax.constants.ts`: `STCG_RATE`, `LTCG_RATE`, `LTCG_EXEMPTION_PER_FY`
as named constants with a comment citing the rate's effective date (these change with the Union
Budget — the July 2024 budget set STCG at 20% and LTCG at 12.5% above a ₹1.25L/FY exemption for
equity, current as of this writing but must be re-verified against the applicable Budget before
implementation, not assumed from this plan). Centralizing these means a future Budget change is a
one-file edit, not a prompt-copy hunt.

### 4. Expose as a callable tool, not raw context

Do **not** dump reconciled lot data into the advisor's context and ask the LLM to compute STCG/LTCG
gains itself — LLMs are unreliable at multi-step arithmetic, and a wrong tax estimate is a worse
failure mode than "I can't check that right now." Instead, follow the existing `web_search` tool-call
pattern (`webSearchToolDefinition` in `advisor.chain.ts`): add an `estimate_capital_gains` tool that,
given a symbol (or "top N by value"), runs the fetch + reconciliation deterministically in code and
returns a formatted summary string for the model to relay in its persona voice — the model narrates,
it doesn't calculate.

### 5. System prompt update

Add a short TAX section to `SEBI_ADVISOR_SYSTEM_PROMPT` instructing Drishti to call
`estimate_capital_gains` whenever asked about STCG/LTCG, tax on exit, or capital gains — and to always
append the grandfathering caveat when any lot's classification could be affected (i.e., any LTCG lot
dated before Jan 31, 2018 — unlikely for an active trading book, but the caveat should be conditional,
not blanket, so it doesn't clutter every answer).

## Non-negotiables checklist (per CLAUDE.md)

- [ ] External API response parsed via Zod (`HistoricalTradesResponseSchema`), never cast.
- [ ] All Upstox I/O through `portfolio.tools.ts` — no inline fetch in the reconciliation or advisor
      logic.
- [ ] Errors caught and logged (`agent_logs`), never swallowed — a historical-trades fetch failure
      should degrade to "I can't verify your exact tax position right now" per the persona's existing
      "insufficient data" rule, not a hard crash.
- [ ] Unit tests for `fetchHistoricalTrades` (mocked fetch) and `reconcileLots` (pure, no mocks needed)
      covering the edge cases above.
- [ ] No real network calls in tests.

## Rollout notes

Read-only feature — no order placement, no `DRISHTI_DRY_RUN` interaction. Safe to build and test
outside market hours since it only touches historical trade and holdings data, not live quotes.

## Open questions for the portfolio owner

1. Confirm current STCG/LTCG rates and exemption threshold against the latest applicable Budget before
   hardcoding `tax.constants.ts` — do not trust this document's numbers as of implementation time.
2. Decide whether v1 should silently skip grandfathering (with a caveat) or explicitly refuse to
   estimate gains for any lot dated before Jan 31, 2018. Recommendation: caveat, not refusal — refusal
   makes the feature useless for anyone with an older portfolio.

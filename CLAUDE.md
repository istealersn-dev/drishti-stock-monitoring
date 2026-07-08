# CLAUDE.md — Drishti Operating Instructions

This file governs how Claude Code works on this project.
Read this before touching any file. Follow every instruction exactly.

---

## What is Drishti?

Drishti (दृष्टि — "watchful eye") is a hybrid autonomous stock monitoring and
trading agent running locally on a Mac Mini M4 Pro. It monitors an Upstox
portfolio, manages GTT orders, fires stop-loss exits autonomously, and requires
explicit user approval before placing any new buy orders. All alerts, decisions,
and approval requests are pushed to Slack. A minimal local React dashboard
acts as a control panel.

---

## Non-negotiables

- **Never place a market order.** GTT orders only. No market order function
  should exist anywhere in the codebase.
- **Never place a new buy GTT without user approval.** The approval flow via
  Slack interactive buttons is mandatory for all buy instructions. If the
  approval service is unavailable, abort and alert — never proceed.
- **Respect `DRISHTI_DRY_RUN`.** When `DRISHTI_DRY_RUN=true`, all Upstox
  write calls (GTT create/modify/cancel, order placement) must be skipped.
  Log what would have happened instead. This env var must be checked at the
  call site, not at the top of the file.
- **Never commit secrets.** `.env` is gitignored. Use `env.example` with
  placeholder values only.
- **SQLite is the only database.** Do not introduce Postgres, Redis, or any
  external data store.
- **LM Studio is the primary LLM provider.** No calls to OpenAI or any other
  cloud API. The LLM runs locally via LM Studio at `http://localhost:1234`.
  Model: `google/gemma-4-12b-qat` (QAT 4-bit, ~7GB, safe on 24GB M4 Pro).
  Do NOT use the BF16 variant — it requires significantly more RAM.
  Avoid Qwen3/Qwen3.5 — LM Studio has open bugs where thinking mode cannot
  be disabled, leaving content always empty (issues #1990, #16945).
  Note: `google/gemma-4-12b-qat` also runs in thinking mode on this LM Studio
  deployment (confirmed 2026-07-03) — it emits chain-of-thought into a
  `reasoning_content` field, which can starve `content` empty on small
  `max_tokens` budgets (under ~500) even though it isn't one of the models
  flagged above. Use `reasoning_effort: "none"` (LM Studio/llama.cpp vendor
  field, not in the OpenAI SDK's typed `ReasoningEffort` union — requires a
  raw fetch call, see `chatOnceNoReasoning` in `llmClient.ts`) for any new
  low-token-budget prompt, and verify via a raw API call first rather than
  assuming a model is reasoning-free.
  Cap context length at 8K for portfolio analysis prompts — the full 256K window
  is unnecessary and wastes RAM headroom.
  Gemini 2.5 Flash was used as a temporary stand-in for the advisor persona /
  thread-continuity feature while the Mac Mini had no power backup; it has
  since been reverted back to LM Studio now that UPS + power backup is in
  place. Do not reintroduce a cloud LLM provider without updating this note.

---

## Hybrid autonomy model

| Action | Mode |
|---|---|
| SL breach on existing holding | Auto — GTT exit placed immediately |
| New buy instruction (any channel) | Slack approval required before any order |
| Entry GTT placement after approval | Auto |
| T1 price hit | Alert only — user decides |
| T2 price hit | Alert only — user decides |
| Existing GTT modify/cancel (LLM-driven) | Auto |
| Daily digest | Auto |

---

## Buy instruction format

Users send buy instructions in natural language from three channels:
- Slack alert channel message
- Dedicated Slack command channel message
- UI dashboard input

**Canonical format:**
```
"Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
```

The instruction parser must extract:
- `stockName` — free-text name, resolved to Upstox symbol via search
- `action` — BUY (only BUY instructions require approval; SELL is handled autonomously via SL)
- `entryRange` — lower and upper bound (e.g. 560–580)
- `stopLoss` — absolute price
- `targets` — array of prices; last item may be suffixed with `+` indicating open-ended

Qty is never in the instruction. The agent calculates suggested qty from
available cash/margin at the midpoint entry price and includes it in the
Slack approval card.

The word "Buy" is recommended but **not required** — `parseInstruction` forces
`action: "BUY"` regardless of what the model extracts, since it's only ever
invoked after the intent classifier has already determined the message is an
order (e.g. `"Goldbees 120-123 SL 110 Tgt 140-170"` parses fine with no "Buy").
The one place "Buy" *is* effectively required is the regex fallback
(`BUY_INSTRUCTION_REGEX = /\bbuy\b.*\d/i`) used only when the LLM classifier
itself is unavailable — keep that word in your instructions as good practice
so a classifier outage doesn't leave you without an order-routing signal.

---

## Working agreement

- Default to **plan-first**: propose a plan and get approval before editing.
- This is a private repo; default branch is `main`. **Branch-per-feature (`feat/`, `fix/`, `refactor/`) is now in effect** — scaffolding is done, work lands via PRs into `main` (PRs #1–#3 already merged). Commit-msg/pre-commit/pre-push hooks are live (commitlint rejects start-case subjects — write "add GitHub Actions gates", not "GitHub Actions gates").
- **One concern per PR.** A `feat(scope)` PR shouldn't also carry `chore(lint/ts/config)` work — split tooling/config changes into their own PR. (Folding was allowed once under time pressure; don't make it the habit.)
- **Run the `commit-gate` agent (Haiku) before any in-session `git commit`.** It runs lint + typecheck + tests and returns GO / NO-GO with failure triage, so you catch breakage before the husky pre-commit hook does. Only commit on GO. (The hook still enforces the same gate deterministically for every commit.)
- **Implementation loop (mandatory for every feature slice):** Once implementation is complete and the PR is open, run `/review <PR#>` → fix all confirmed/plausible findings → re-review until zero findings → merge. No PR lands without passing this gate. The user owns task selection (which ticket to build next); Claude owns execution end-to-end once the task is identified.
- **Keep this file alive (Boris Cherny's rule):** when Claude does something wrong, add a line here so it doesn't repeat. Ruthlessly edit over time.
- All branches must go through rigorous review process, loop /code-review and /security-review & fix findings until ZERO findings followed by post-PR /review & fix until ZERO findings -> merge the PR
- **You DON'T touch production without a PR getting merged.** No `wrangler pages deploy` (or any other deploy command) against the production target from an unmerged branch or an uncommitted local build — not even to "verify it live" or for an "emergency fix." This happened once (2026-07-08: UI deploys ran straight from local builds on open PRs, leaving production serving an unmerged branch while `main` sat one PR behind — the review loop became theater once the code was already live). Emergency fixes still go through a PR — merge first (fast-track the review if it's genuinely urgent), *then* deploy from `main`. If you want to show a change live before merging, use a Cloudflare Pages preview/branch-alias URL, which never touches the production domain.

## How to work

### One phase at a time

`PLAN.md` defines six phases. Complete Phase 1 fully before starting Phase 2.
A phase is complete when all its acceptance criteria pass. Run the criteria
checks explicitly and report results before moving on.

### Check before creating

Before creating any new file, check if it already exists. Before adding a
dependency, check `package.json`. Never install a package that duplicates an
existing one (e.g. do not add `axios` if `node-fetch` is already present).

### Small, verifiable commits

Work in small logical units. After each unit, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must pass before proceeding. Never skip these checks.

### Never guess at Upstox API behaviour

The Upstox v3 API docs are the source of truth. If a response shape is
unclear, print the raw response and inspect it before writing types.

### Session efficiency

- **JS-rendered sites need the browser, not WebFetch.** Marketing pages, SPAs,
  and anything client-side rendered return header-only fragments to WebFetch
  (confirmed on algoip.in — six wasted fetches). Use the Chrome MCP tools
  directly for those; reserve WebFetch for docs, forums, blogs, and other
  static pages.
- **Use an Explore subagent for "find/locate X" tasks.** Don't read a trail of
  files into the main context to answer "where is X defined / which code builds
  message Y" — dispatch Explore and get a summarized answer back.
- **Never run vitest in watch mode.** Package `test` scripts use `vitest run`;
  a bare `vitest` in an agent session never exits and hangs the task.

---

## Commands

```bash
pnpm dev          # start backend agent (tsx watch)
pnpm dev:ui       # start React dashboard (Vite)
pnpm build        # build both packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm lint         # eslint across all packages
pnpm test         # vitest run (single pass, no watch) across all packages
pnpm db:migrate   # run pending SQLite migrations
pnpm agent:dry    # start agent with DRISHTI_DRY_RUN=true
```

---

## Architecture rules

- Feature-driven folder structure — one folder per feature, not per layer.
  See `PLAN.md` for the full structure.
- Every public function must have a JSDoc comment with `@param` and `@returns`.
- All external I/O (Upstox API, Slack, LM Studio, SQLite) must go through a
  dedicated tool/service file. No inline fetch calls in agent logic.
- Zod schemas define the shape of every external API response. Parse, never cast.
- Errors from external services must be caught, logged to SQLite
  (`agent_logs` table), and never silently swallowed.

---

## TypeScript rules

- `strict: true` — no exceptions.
- No `any`. Use `unknown` and narrow explicitly.
- No `as` casts except when narrowing after a Zod parse.
- All async functions must be typed with explicit return types.
- Prefer `type` over `interface` for data shapes. `interface` only for
  contracts that will be extended.

---

## Testing rules

- Every tool function must have at least one unit test.
- Agent decision logic must be tested with mocked tool responses.
- The instruction parser must have tests covering: standard format, missing
  T2, open-ended T2 (`800+`), partial data, unrecognised stock name.
- The approval flow must be tested: approval received, rejection received,
  timeout (no response in 10 minutes).
- Use `vitest` and `@vitest/coverage-v8`.
- No test should make a real network call. Mock Upstox, LM Studio, and Slack
  at the boundary.

---

## When you are unsure

Stop. Write a short summary of the ambiguity to stdout and wait. Do not
make assumptions that affect data writes, order placement, or the LLM prompt
design.

## Reference documents

The `docs/` folder contains portfolio planning documents provided by the
portfolio owner. These are read-only reference material.

- `docs/investment-plan.pdf` — 18-stock MTF deployment plan, order parameters,
  watchlist, SIP basket
- `docs/portfolio-book.pdf` — handwritten portfolio strategy notes including
  tier structure, sector allocation, BeES basket, and MF selections

### How to use these in agent context

- `features/insights/insights.prompts.ts` — the system prompt may reference
  sector allocation and stock tiers from the portfolio book when reasoning
  about hold/exit decisions
- `features/digest/digest.builder.ts` — the morning digest may cross-reference
  the watchlist (10 stocks) to flag if any watchlist stock is approaching a
  good entry
- Do NOT hardcode any values from these documents into source code. Read them
  as context only — the source of truth for SL thresholds and targets is
  always the `stock_config` table in SQLite.
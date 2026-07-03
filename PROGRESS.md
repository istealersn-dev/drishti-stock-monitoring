# Drishti UI Rebuild — Progress

Source of truth: [project/Design.md](project/Design.md), [project/handoff.md](project/handoff.md),
[project/Drishti.dc.html](project/Drishti.dc.html) (pixel/behaviour reference, pulled from the
`Drishti portfolio dashboard` Claude Design project). No `chats/*.md` exists — handoff.md §8
covers decision context instead.

Working mode: **plan-first per checkpoint** (user preference, 2026-07-03) — propose a plan for
each checkpoint, get a go-ahead, implement it, open the PR, then move to the next checkpoint.

## Checkpoints

| CP | Scope | Status | Branch | PR |
|---|---|---|---|---|
| 1 | Monorepo + design tokens | pr-open, review-clean, awaiting merge | `feat/cp1-design-tokens` | [#25](https://github.com/istealersn-dev/drishti-stock-monitoring/pull/25) |
| 2 | UI primitives A (Button, Badge, Card, Input, Textarea, StatusDot, Breadcrumb) | todo | — | — |
| 3 | UI primitives B (Radix: Select, Switch, Tabs, Dialog, Toast, Tooltip, ScrollArea, MessageBubble, Table) | todo | — | — |
| 4 | App scaffold + responsive shell + Login | todo | — | — |
| 5 | Ask Drishti (hero, composer, AmbientWave, chat) | todo | — | — |
| 6 | Dashboard + Holdings | todo | — | — |
| 7 | Instructions + GTT + Logs | todo | — | — |
| 8 | Settings + data layer + hardening | todo | — | — |

## Decisions log

- **2026-07-03** — `project/Design.md` and `project/handoff.md` did not exist in this repo at
  mission start. Retrieved from the user's claude.ai/design project `Drishti portfolio dashboard`
  (projectId `a79683e4-0f19-495d-87d9-a88c5cf9d47d`) via `DesignSync`, saved locally.
- **2026-07-03** — Confirmed with user: full replace of `packages/ui` (not incremental adaptation),
  matching the mission and handoff.md.
- **2026-07-03** — Confirmed with user: Prisma v7 is intentional (handoff.md §1/§5 non-negotiable,
  user-authored spec), targeting SQLite as the datasource — does not violate CLAUDE.md's
  "SQLite is the only database" rule.
  **Open flag for CP8**: `packages/agent` already has a working Fastify + Drizzle ORM + SQLite
  backend that the current `packages/ui` calls via REST (`src/lib/api.ts`). Introducing Prisma
  would add a second ORM in the same repo — need to decide at CP8 whether Prisma sketch in
  handoff.md §5 becomes the new UI-owned API/data layer (replacing or fronting the agent's
  Drizzle layer) or whether it's descriptive-only and the UI keeps consuming the existing agent
  API. Revisit with user before CP8 implementation.
- **2026-07-03** — Confirmed with user: plan-first per checkpoint (not fully autonomous 8-checkpoint
  loop), matching CLAUDE.md's default working agreement.
- **2026-07-03** — Verified `packages/ui` is dev-server only (Vite, port 5173) — not served by the
  pm2-managed `drishti-agent` process in production. Full replace during CP1–CP8 does not risk the
  live agent, Slack approval flow, or SL-exit automation.
- **2026-07-03** — CP1 implemented additively: new gold-branded `@theme` tokens/keyframes appended
  to `app.css` alongside the legacy indigo system, so `pnpm dev:ui` stays fully working on old
  pages throughout CP1–CP3. New `/tokens` route added as a standalone compliance/preview page.
  Guardrail lint (ban style attr, ban hex/px in both plain-string and template-literal
  `className`, warn on stray absolute/fixed) scoped to `packages/ui/src/pages/tokensPreview.tsx`
  only for CP1; widen the glob each checkpoint as more files migrate. Verified via computed-style
  inspection in the preview browser (exact hex/radius/shadow/animation-duration matches) —
  screenshots of the token page looked misleadingly dark/low-contrast due to JPEG compression of a
  near-black palette, so computed-style checks were used instead, per near-black-on-black nature
  of the design.
  **Correction (post-`/review`)**: "no name collisions" was wrong for four tokens —
  `--radius-xs/sm/md/lg/xl/2xl/3xl/pill`, `--font-sans`, `--font-mono`, and
  `--color-border-strong` share names with the legacy `@theme` block (both systems independently
  used Tailwind's conventional `rounded-*`/`font-*` utility naming; `border-strong` is a
  coincidental name match). Tailwind v4 keeps only the later declaration for a given custom
  property, so the new (Design.md) values are now authoritative everywhere, including on
  not-yet-migrated pages (confirmed via `vite build` output: `--radius-xl` → `9px` not legacy's
  `8px`; `--color-border-strong` → `#2b2925` not legacy's `#232323`). Measured delta is small
  (1–4px radius, ~3% RGB shift on a near-black border) and confirmed visually negligible
  (`/login` screenshot unchanged). Chose to accept this rather than rename tokens (would create
  spec drift from handoff.md's literal variable names) or touch legacy files outside CP1's scope
  (`login.tsx`, `gtt.tsx`, `app.css`'s legacy block) — but the actual color/surface/text/semantic
  palette tokens (`bg-*`, `surface-*`, `fg-*`, `gold-*`, `pos`/`neg`/`warn`/`info`) genuinely have
  zero collisions, confirmed via full name diff of both `@theme` blocks.
- **2026-07-03** — Found `pnpm lint` already failing on `main` (3 pre-existing, CP1-unrelated
  errors: missing return type in `packages/agent/src/features/slack-commands/slackCommands.handlers.ts`,
  an abbreviated variable name in `packages/ui/src/components/layout/topbar.tsx`, and a missing
  `include` entry in `packages/token-refresh/tsconfig.json` for its `vitest.config.ts`). Fixed in
  a separate `fix/lint-baseline` branch, [PR #26](https://github.com/istealersn-dev/drishti-stock-monitoring/pull/26),
  per the "one concern per PR" rule, rather than bundling into CP1. `/review` (2-angle pass) on
  PR #26 came back clean — zero findings, no fixes needed. Also fixed the `token-refresh` gap
  correctly: added `packages/token-refresh/tsconfig.tooling.json` (mirroring the existing
  `packages/agent/tsconfig.tooling.json` pattern) rather than adding `vitest.config.ts` to the
  package's real build tsconfig, which has `rootDir: "src"` and would hard-error (`TS6059`) on a
  root-level file. Noted for later (not acted on, not required by any stated rule): a future
  cleanup could consolidate all per-package `tsconfig.tooling.json` files into one root-level
  glob in `eslint.config.ts`'s `parserOptions.project` — deferred as its own, separately-verified
  change per the reviewing agent's own recommendation.
  Also discovered while running tests locally: `packages/agent`'s test suite has 3 files that
  fail in this worktree due to missing `.env` (Upstox/Slack credential validation) and missing
  native `better-sqlite3` bindings — confirmed identical on unmodified `main`, so this is a local
  dev-environment gap, not a code issue. Not fixed (out of scope for both PRs); flagging here in
  case it surprises the next session. `packages/token-refresh`'s test suite is fully green.
- **2026-07-03** — `/review` on PR #25 (5-angle medium-effort pass) surfaced and fixed: missing
  JetBrains Mono weight 400 import (legacy pages using `font-mono` with no explicit weight were
  silently falling back to the system monospace font), a `prefers-reduced-motion` CSS override
  that targeted nonexistent `.ambient`/`.breathe` classNames instead of the real
  `animate-wave-x`/`animate-wave-y`/`animate-breathe` utility classes (reduced-motion users were
  still getting the ambient animation), guardrail lint regex selectors that only matched plain
  string `Literal` nodes and silently no-op'd on template-literal classNames (the dominant pattern
  in `tokensPreview.tsx` itself), and a real TS strict-mode violation in the custom
  `flagStrayPositionRule` (`node.parent` narrowed against a JSX-specific type that plain
  `eslint`/estree types don't include — invisible to `pnpm typecheck` because it only recurses
  into `packages/*` and never runs the root `tsconfig.json` that actually includes
  `eslint.config.ts`). Also simplified `tokensPreview.tsx`'s 5 duplicated swatch-array/render
  blocks into one `COLOR_GROUPS` loop.

## Constraints checklist (re-verify every checkpoint)

- [ ] Zero inline styles / `style={{}}`
- [ ] Zero raw hex/px literals in components (tokens only)
- [ ] Semantic HTML (no div soup)
- [ ] flex/grid layout; `position` only for genuine overlays
- [ ] Single breakpoint (760px; login 820px)
- [ ] Continuous motion, `prefers-reduced-motion` respected
- [ ] Focus-visible, color-never-alone, contrast per Design.md §7
- [ ] Gold = brand only; semantic colors reserved
- [ ] ₹ formatting; tickers mono/uppercase

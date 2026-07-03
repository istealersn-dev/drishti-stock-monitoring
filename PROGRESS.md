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
| 1 | Monorepo + design tokens | pr-open | `feat/cp1-design-tokens` | pending push |
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
  to `app.css` alongside the untouched legacy indigo system (no name collisions), so `pnpm dev:ui`
  stays fully working on old pages throughout CP1–CP3. New `/tokens` route added as a standalone
  compliance/preview page. Guardrail lint (ban style attr, ban hex/px, warn on stray
  absolute/fixed) scoped to `packages/ui/src/pages/tokensPreview.tsx` only for CP1; widen the glob
  each checkpoint as more files migrate. Verified via computed-style inspection in the preview
  browser (exact hex/radius/shadow/animation-duration matches) — screenshots of the token page
  looked misleadingly dark/low-contrast due to JPEG compression of a near-black palette, so
  computed-style checks were used instead, per near-black-on-black nature of the design.
- **2026-07-03** — Found `pnpm lint` already failing on `main` (3 pre-existing, CP1-unrelated
  errors: missing return type in `packages/agent/src/features/slack-commands/slackCommands.handlers.ts`,
  an abbreviated variable name in `packages/ui/src/components/layout/topbar.tsx`, and a missing
  `include` entry in `packages/token-refresh/tsconfig.json` for its `vitest.config.ts`). Fixed in
  a separate `fix/lint-baseline` branch/PR per the "one concern per PR" rule, rather than bundling
  into CP1.

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

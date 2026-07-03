# Drishti — Engineering Handoff

Production rebuild spec for the Drishti dashboard. The design prototype lives in `Drishti.dc.html`
(a single self-contained file used for design only — inline styles there are a constraint of the
prototyping tool, **not** the target). This document defines how to rebuild it for production.

Read `Design.md` first — it is the source of truth for every token, state and layout rule.

---

## 1. Stack (non-negotiable)

| Concern | Choice |
|---|---|
| UI runtime | **React 19** (Server Components off / SPA; use `use`, Actions, `useOptimistic` where they fit) |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` config) — **zero inline styles, zero raw hex/px in components** |
| Primitives | **Radix UI Primitives** (unstyled) — Dialog, Select, Switch, Tabs, Tooltip, ScrollArea, Toast |
| Validation | **Zod** — every form, API boundary and env var |
| Routing | **TanStack Router** (file or code-based, type-safe) |
| Data | **TanStack Query** (server state, polling, optimistic mutations) |
| ORM | **Prisma v7** |
| Icons | `lucide-react` (matches the stroke-2 line icons in the prototype) |
| Fonts | `Inter` + `JetBrains Mono` (self-hosted via `@fontsource` or `next/font` equivalent) |

**Hard rules**
- No `style={{…}}` anywhere. No `#hex` or `12px` literals in `.tsx` — only Tailwind classes bound to `@theme` tokens.
- Minimise `position: relative/absolute`. Layout with **flexbox / grid / `gap`**. Absolute positioning is allowed only for genuinely overlaid UI: status-dot glow, dropdown/popover (Radix owns these), the decorative ambient layer (`aria-hidden`), and the ask-screen canvas. Everything currently using `position` for spacing must be refactored to flow layout.
- Semantic HTML first (§6).
- Mobile-first: author base styles for `< 760px`, layer desktop at the `md`/custom `nav` breakpoint.

---

## 2. Tailwind v4 theme setup

Define all Design.md tokens once in `app.css`:

```css
@import "tailwindcss";

@theme {
  /* surfaces */
  --color-bg-base: #0a0a0a;
  --color-bg-chrome: #0d0d0c;
  --color-surface: #161513;
  --color-surface-2: #131210;
  --color-surface-3: #121110;
  --color-surface-input: #151412;
  --color-surface-hover: #1b1a17;
  /* borders */
  --color-border: #242320;
  --color-border-strong: #2b2925;
  --color-border-muted: #2a2825;
  /* text */
  --color-fg: #efece4;
  --color-fg-soft: #e6e2d8;
  --color-fg-muted: #9a9a9a;
  --color-fg-dim: #8a8a8a;
  --color-fg-faint: #6a6a6a;
  --color-fg-ghost: #4a463e;
  /* brand */
  --color-gold: #c8a24a;
  --color-gold-deep: #9a7a2e;
  --color-gold-bright: #e2c584;
  --color-gold-tint: #ecd5a0;
  /* semantic */
  --color-pos: #22c55e;
  --color-neg: #ef4444;
  --color-neg-soft: #f87171;
  --color-warn: #f59e0b;
  --color-info: #93b0f7;

  --radius-sm: 6px; --radius-md: 7px; --radius-lg: 8px;
  --radius-xl: 9px; --radius-2xl: 11px; --radius-3xl: 14px;

  --shadow-card: 0 12px 38px rgb(0 0 0 / .42);
  --shadow-gold: 0 4px 14px rgb(200 162 74 / .30);

  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --breakpoint-nav: 760px; /* the single shell breakpoint */
}

@keyframes wave-x { from { transform: translateX(-28px) } to { transform: translateX(28px) } }
@keyframes wave-y { from { transform: translateY(-22px) } to { transform: translateY(22px) } }
/* pulse, breathe, spin, fade — see Design.md §4 */

@media (prefers-reduced-motion: reduce) {
  .ambient, .breathe { animation: none !important; }
}
```

Tinted fills (Dry-Run pill, pending badge, danger cards) → `bg-warn/10 border-warn/35` etc. via Tailwind's `/opacity` on theme colors. Never hand-write rgba in components.

---

## 3. Routes (TanStack Router)

```
/login                       → LoginPage (split ≥820px, stacked below)
/  (authed layout)
  ├── /ask        (index)    → AskDrishtiPage      (empty hero ⇄ conversation)
  ├── /dashboard             → DashboardPage       (stats + needs-attention)
  ├── /holdings              → HoldingsPage        (table ⇄ card list)
  ├── /instructions          → InstructionsPage    (buy-instruction + approvals)
  ├── /gtt                   → GttOrdersPage        (GTT table ⇄ card list)
  ├── /logs                  → AgentLogsPage        (filterable audit trail)
  └── /settings              → SettingsPage
        ├── /settings/brokers   (index)
        ├── /settings/agent
        ├── /settings/runtime   → Model & API access (BYO key / provider / model)
        └── /settings/danger
```

- The authed layout renders the responsive shell: `<Sidebar>` (desktop) / `<MobileTabBar>` (mobile), `<AppFooter>`, `<Outlet/>`. Pick shell by a `useMediaQuery('(min-width: 760px)')` hook, **not** by duplicating every screen — build **one** set of page components that reflow responsively (the prototype's separate desktop/mobile trees collapse into responsive components here).
- Settings tabs = nested routes, not local state.
- Auth guard via `beforeLoad` redirect to `/login`.

---

## 4. Component tree

```
components/
  ui/                      # Radix-backed, token-styled primitives
    Button.tsx  Badge.tsx  Card.tsx  Input.tsx  Textarea.tsx
    Select.tsx  Switch.tsx  Tabs.tsx  Dialog.tsx  Toast.tsx
    Tooltip.tsx  ScrollArea.tsx  StatusDot.tsx  Breadcrumb.tsx
  shell/
    AppShell.tsx  Sidebar.tsx  MobileTabBar.tsx  AppHeaderMobile.tsx  AppFooter.tsx
    AmbientWave.tsx          # canvas + drifting blobs (ask screen only, aria-hidden)
  ask/  MessageList.tsx  MessageBubble.tsx  Composer.tsx  SuggestionGrid.tsx
  dashboard/  StatCard.tsx  NeedsAttentionCard.tsx
  holdings/  HoldingsTable.tsx  HoldingCard.tsx  HoldingFilters.tsx
  gtt/  GttTable.tsx  GttCard.tsx
  logs/  LogRow.tsx  LogFilters.tsx
  instructions/  InstructionComposer.tsx  ApprovalCard.tsx
  settings/  BrokerCard.tsx  AgentControls.tsx  ModelAccessForm.tsx  DangerZone.tsx
```

- **HoldingsTable/HoldingsCard** and **GttTable/GttCard** are one logical component each that switches presentation at `nav` breakpoint (render table on desktop, card list on mobile) — share the row view-model.
- **AmbientWave**: keep the bounded-sine canvas + `alternate` blob animation from the prototype. Persist the time origin so re-renders don't reset it. Mount only when the ask conversation is empty.
- **ModelAccessForm**: provider `Select` → model `Select` (options depend on provider), API-key `Input type=password` + Save, or Ollama endpoint field for the local provider. Status line reflects saved/not-set. (Replaces the old read-only runtime panel — no logged-in-user or tunnel/session references.)

---

## 5. Data layer

### Prisma v7 (sketch — adapt to real broker integration)
```prisma
model Account   { id String @id @default(cuid()) label String brokers Broker[] settings Settings? }
model Broker    { id String @id name String connected Boolean canRead Boolean canOrder Boolean accountId String account Account @relation(fields:[accountId],references:[id]) }
model Holding   { id String @id symbol String exchange String product String qty Int avg Float ltp Float sl Float? target Float? sector String paused Boolean }
model Gtt       { id String @id symbol String type GttType trigger Float limit Float qty Int status GttStatus createdAt DateTime approvalId String? }
model Instruction { id String @id symbol String name String entry String sl Float t1 Float t2 String px Float qty Int value Float status ApprovalStatus createdAt DateTime }
model AgentLog  { id String @id ts DateTime run String symbol String? action String sub String? reason String dryRun Boolean error String? }
model Settings  { id String @id accountId String @unique dryRun Boolean paused Boolean pollInterval Int marketOpen String marketClose String approvalTimeout Int llmProvider String llmModel String llmEndpoint String? /* llmKey stored encrypted, never returned to client */ }
enum GttType { buy sl target two }
enum GttStatus { active triggered cancelled }
enum ApprovalStatus { pending approved rejected }
```
**Never** return `llmKey` to the client — expose only `keyConfigured: boolean`.

### TanStack Query
- Query keys: `['holdings']`, `['gtts']`, `['instructions']`, `['logs', filter]`, `['settings']`, `['portfolio']`.
- Poll portfolio/holdings on the configured interval (`refetchInterval` from settings; the footer "Last poll" reads `dataUpdatedAt`).
- Mutations (approve/reject instruction, cancel GTT, save settings, save LLM key, toggle broker permission, toggle dry-run) → **optimistic** update + invalidate. Destructive ones go through a Radix Dialog confirm.
- Streaming for Ask-Drishti: POST question → stream tokens into the assistant bubble (SSE / `ReadableStream`).

### Zod
- One schema per mutation input + per API response; infer types (`z.infer`) instead of hand-writing interfaces.
- `ModelAccessForm`: `z.object({ provider: z.enum(['anthropic','openai','google','local']), model: z.string().min(1), apiKey: z.string().min(8).optional(), endpoint: z.string().url().optional() }).refine(local ⇒ endpoint required else apiKey required)`.
- Buy-instruction parser: validate the `[Stock] Buy [entry] SL [price] Tgt [T1] [T2+]` free-text into a typed instruction; surface Zod errors inline.
- Validate `process.env` (broker keys, DB URL, encryption key) at boot.

---

## 6. Semantic HTML map

| Region | Element |
|---|---|
| Desktop sidebar | `<aside>` with `<nav>` inside; nav items are `<a>` (router links), active = `aria-current="page"` |
| Mobile tab bar | `<nav aria-label="Primary">` with `<a>` links |
| Top bars | `<header>` |
| Page content | `<main>` (one per shell, router `<Outlet/>` inside) |
| Footer | `<footer>` |
| Ask hero heading | `<h1>`; section labels `<h2>` |
| Holdings/GTT desktop | `<table>` (`<thead>/<tbody>/<th scope>`), or an ARIA grid if virtualized |
| Cards | `<article>` / `<section>` with a heading |
| Forms | `<form>` + `<label for>`; toggles use Radix Switch (labelled) |
| Status pill | text + icon, not color alone |
| Decorative wave/blobs | `aria-hidden="true"` |

No layout achieved via `position` where flex/grid + `gap` works. The footer pins to the viewport with a `flex-col h-dvh` shell (row `flex-1 min-h-0`, footer `shrink-0`) — **not** absolute positioning.

---

## 7. Build order (suggested)

1. Scaffold: Vite + React 19 + Tailwind v4 `@theme` + TanStack Router/Query + Prisma + Zod.
2. `components/ui/*` primitives against the tokens (Storybook optional). Verify all states from Design.md §6.
3. AppShell + Sidebar + MobileTabBar + AppFooter, responsive at `760px`. Confirm footer pins & sidebar collapses.
4. Ask-Drishti (hero, composer, suggestions, conversation, AmbientWave, streaming).
5. Dashboard → Holdings → GTT → Instructions → Logs (table⇄card responsive pairs, TanStack Query wiring).
6. Settings (nested routes: Brokers, Agent, Model access, Danger) with Zod forms + confirm dialogs.
7. Prisma schema + API routes + optimistic mutations; secure the LLM key.
8. Pass: a11y (focus-visible, landmarks, contrast), `prefers-reduced-motion`, no-inline-style lint rule, no stray `position`.

### Guardrails to enforce in CI
- ESLint: ban `style` JSX attribute, ban hex/px literals in `.tsx` (custom rule / `eslint-plugin-tailwindcss`).
- Type-check TanStack Router route tree.
- Zod-validate all env at startup.

---

## 8. What changed in the latest design pass (context for the rebuild)
- Footer pins to viewport (shell height fix); footer values match label size but bold.
- Ambient animation is continuous (bounded sine, `alternate`, persistent time origin) — no reset.
- Ambient wave shows only on the empty Ask screen.
- Conversation view has an "Ask Drishti › Conversation" breadcrumb (crumb returns to the empty ask page).
- Collapsed sidebar keeps the logo visible & centered; logo toggles expand.
- Footer "pending" badge is `info` (indigo), distinct from the `warn` (amber) Dry-Run pill.
- Settings "Model & runtime" → **Model & API access**: bring-your-own-key provider/model provisioning; removed all logged-in-user and Cloudflare-tunnel/session references.

---

## 9. Prototype semantic & positioning audit (measured on `Drishti.dc.html`)

Ran against the current prototype so the rebuild knows exactly what is already compliant vs. what it must upgrade. The **production build must reach full compliance** per §6 — the notes below are the prototype's actual state.

### `position` — PASS (no abuse)
54 declarations total: 23 `absolute`, 23 `relative`, 6 `fixed`, 2 `sticky`. Every one is a legitimate overlay / stacking context, **none used for spacing**:
- `relative` contexts anchor a genuinely overlaid child only: stat-card top accent bar, switch-track knob (Radix `Switch` will own this in prod), search-field icon, nav pending-dot badge, and z-index layering above the decorative/canvas layer.
- `fixed`: ambient blobs + canvas layer (`aria-hidden`) and the mobile bottom tab-bar.
- `sticky`: Ask composer bar.
- All real layout is flex/grid + `gap`. **Keep this discipline in the rebuild.**

### Semantics — PARTIAL (rebuild must close these)
Compliant: `<header>`, `<nav>`×2, `<main>`, `<footer>`, `<aside>`, `<h1>`, 70 native `<button>` (no click-divs).

Gaps to fix in production (all already specified in §6):
| Gap | Prototype | Production requirement |
|---|---|---|
| Forms | 0 `<form>` | Wrap Ask composer, holdings SL/target, buy-instruction, settings, login in `<form>` with submit semantics |
| Labels | 0 `<label>` | Every input/select/textarea gets a `<label for>` (visible or `sr-only`); Radix Switch labelled |
| Tabular data | 0 `<table>` (CSS-grid divs) | Holdings & GTT desktop → `<table>`/`<thead>/<tbody>/<th scope>` (or ARIA grid if virtualized) |
| Grouping | cards are `<div>` | Cards → `<section>`/`<article>` with a heading |
| Navigation | nav items are `<button>` | Sidebar & tab-bar items → `<a>` router links with `aria-current="page"` |

The prototype's separate desktop/mobile DOM trees also collapse into single responsive components in the rebuild (§3–§4), which is the natural point to introduce the correct semantic elements.

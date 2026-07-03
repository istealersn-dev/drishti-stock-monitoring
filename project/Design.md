# Drishti — Design System

> SEBI-aware portfolio-intelligence dashboard. Dark, data-dense, terminal-adjacent — but calm.
> This document is the single source of truth for the visual language. The production build
> (React 19 + Tailwind v4) must be **entirely token-bound**: every value below becomes a
> Tailwind `@theme` token, and **no raw hex / px literals may appear in component code**.

---

## 1. Design principles

1. **Calm under density.** The app shows money, risk and agent actions in real time. Surfaces are near-black, accents are used sparingly, motion is slow and continuous (never blinking or resetting).
2. **Monospace for data, sans for voice.** Numbers, tickers, IDs, timestamps → JetBrains Mono. Prose, labels, headings → Inter.
3. **Gold is the brand, semantics are the signal.** The gold accent marks brand & primary actions; green/red/amber/indigo are reserved strictly for meaning (see §4).
4. **One accent per surface.** Never stack gold + a semantic color competing for attention in the same element.
5. **Touch-first.** Every interactive target is ≥ 44 px on mobile; desktop can be denser.

---

## 2. Color tokens

All colors are dark-theme. Names map 1:1 to Tailwind `@theme` custom properties (`--color-*`).

### Surfaces (background)
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0a0a0a` | App canvas |
| `bg-chrome` | `#0d0d0c` | Sidebar, top header, footer |
| `surface` | `#161513` | Cards, panels |
| `surface-2` | `#131210` | Inset fields, sub-cards, chips |
| `surface-3` | `#121110` | Suggestion tiles, list rows |
| `surface-input` | `#151412` | Icon buttons, inputs |
| `surface-hover` | `#1b1a17` | Nav / row hover |

### Borders
| Token | Hex | Use |
|---|---|---|
| `border` | `#242320` | Default hairline / dividers |
| `border-strong` | `#2b2925` | Card & control outlines |
| `border-muted` | `#2a2825` | Vertical separators |
| `border-focus` | `#c8a24a` | Focus ring (= brand gold) |

### Text
| Token | Hex | Use |
|---|---|---|
| `fg` | `#efece4` | Primary text |
| `fg-soft` | `#e6e2d8` | Data values |
| `fg-muted` | `#9a9a9a` | Secondary labels |
| `fg-dim` | `#8f8d86` / `#8a8a8a` | Tertiary / helper |
| `fg-faint` | `#6a6a6a` | Timestamps, disclaimers |
| `fg-ghost` | `#4a463e` | Breadcrumb chevrons, disabled |

### Brand (gold)
| Token | Hex | Use |
|---|---|---|
| `gold` | `#c8a24a` | Primary accent, active nav, focus |
| `gold-deep` | `#9a7a2e` | Gradient end, gold button base |
| `gold-bright` | `#e2c584` | Gold text on dark, hover |
| `gold-tint` | `#ecd5a0` | Ticker links |
| `gold-line` | `#cbb460` | Ambient wave strokes |
| `gold-grad` | `linear-gradient(135deg, #c8a24a, #9a7a2e)` | Logo mark, primary CTA |

### Semantic
| Token | Hex | Meaning |
|---|---|---|
| `pos` | `#22c55e` | Gains, connected, healthy, "Running" |
| `neg` | `#ef4444` | Loss, danger-zone, destructive |
| `neg-soft` | `#f87171` | Destructive text/icon on tint |
| `warn` | `#f59e0b` | Dry-run mode, breach, caution |
| `info` | `#93b0f7` (rgba `129,161,247`) | Pending approvals (actionable, non-urgent) |

**Tinted fills** follow the pattern `color-mix(in srgb, <semantic> 10-14%, transparent)` with a `35-42%` border of the same hue (e.g. Dry-Run pill, pending badge, danger cards). Encode as `--color-*-tint` / `--color-*-ring` tokens rather than inline rgba.

---

## 3. Typography

- **Sans:** `Inter` (400/500/600) — UI, prose, headings.
- **Mono:** `JetBrains Mono` (500/600/700) — all numeric & machine data: prices, %, qty, tickers, IDs, timestamps, model names, code-like labels, uppercase eyebrow labels.

### Type scale (px → token)
| Token | Size | Weight | Use |
|---|---|---|---|
| `display` | 35 | 600 | Ask-Drishti hero |
| `h1` | 22 | 600 | Login value prop |
| `title` | 18 | 600 | Page title (Settings) |
| `subtitle` | 15 | 400/600 | Section lead, textarea |
| `body` | 13.5 | 400/500 | Nav items, card body |
| `body-sm` | 12.5–13 | 500/600 | Labels, buttons |
| `caption` | 11–11.5 | 500 | Helper text, statuses |
| `micro` | 10–10.5 | 600 | Footer meta, badges (mono) |
| `eyebrow` | 9.5–11 | 600 | Uppercase mono labels, `letter-spacing: .07–.14em` |

Headings use `letter-spacing: -.01em to -.025em`. Body line-height 1.45–1.55.

Minimum body size on any screen: **11px** (mono meta) / **12.5px** (prose).

---

## 4. Radius, spacing, elevation, motion

**Radius:** `xs 5`, `sm 6`, `md 7`, `lg 8`, `xl 9`, `2xl 10-11`, `3xl 14`, `pill 999`, `full 50%` (avatars, status dots). Map to `--radius-*`.

**Spacing:** 4-based scale — 2,3,4,5,6,7,9,10,11,12,13,14,16,18,20,22,26,44. Use Tailwind's spacing scale; the recurring gaps are `gap-2.5` (10), `gap-3` (11–12), and card padding `p-4` (14–16).

**Elevation:**
- `shadow-card`: `0 12px 38px rgba(0,0,0,.42)`
- `shadow-gold`: `0 4px 14px rgba(200,162,74,.30)` (primary CTA, logo)
- `glow-status`: `0 0 7-8px <semantic>` (pulsing health dots)
- `ring-gold`: `0 0 0 1px rgba(200,162,74,.4)` (logo mark)

**Motion** (all `@keyframes`, defined once globally):
| Name | What | Duration/ease |
|---|---|---|
| `wave-x` / `wave-y` | Ambient blob drift — **bounded sine on two axes, `alternate`, negative delays** so it never resets. Also drives the canvas wireframe (bounded phase oscillators). | 15–31s ease-in-out infinite alternate |
| `breathe` | Blob opacity swell | 15–19s |
| `pulse` | Status-dot glow | 2.4s |
| `spin` | Refresh icon | .65s linear |
| `fade` | Message entrance | one-shot |

**Motion law:** looping ambient animation must be **continuous** — use `alternate` direction or a persistent time origin (`performance.now()` stored on the instance) so a React re-render never restarts the timeline. Respect `prefers-reduced-motion` (disable wave + breathe).

---

## 5. Layout & responsive

**Breakpoints:** single hard split at **760px**. `< 760` = mobile shell, `≥ 760` = desktop shell. Login uses a secondary split at **820px** (side-by-side → stacked).

### Desktop shell (≥ 760)
- Outer: `flex-col`, `h-screen`. Row (sidebar + main) is `flex-1 min-h-0`; footer is `flex-none` — footer pins to viewport bottom.
- **Sidebar:** 240px, collapses to 64px. Header row 53px (logo mark always visible; wordmark + collapse chevron only when expanded; collapsed → logo centered and itself toggles expand). Nav `flex-1`; settings/logout pinned bottom.
- **Main:** `flex-1 min-h-0`, single scroll container (`overflow-y-auto`).
- **Footer:** 38px, meta left / session right. Key–value pairs: label = value size (9.5px), value **bold**.

### Mobile shell (< 760)
- Sticky top header 50px (blurred), fixed bottom tab-bar 62px (6 tabs: Dashboard, Holdings, Instr, GTT, Logs, Settings), main scrolls between with `padding-bottom: 80px`.
- Every desktop table becomes a **stack of cards** (holdings, GTT). Dashboard stats → 2-col grid. Filter rows → horizontal scroll chips.
- Ask-Drishti: hero + composer + suggestion grid; conversation view has breadcrumb (`Ask Drishti › Conversation`) + New chat.

**The ambient canvas wave renders ONLY on the empty Ask-Drishti screen** (`askEmpty`), and unmounts the moment a question is asked.

---

## 6. Component inventory

Each maps to a React component (see handoff.md §4). States listed must all be built.

- **Button** — variants: `primary` (gold gradient + shadow), `secondary` (outline `border-strong`, hover `border-muted`/brighten), `ghost` (transparent, hover `surface-hover`), `destructive` (neg tint + neg-soft text), `icon` (28–34px square). States: default / hover / active / focus-visible / disabled (`surface-2` bg, `fg-faint`).
- **Badge / Pill** — status pill (dot + label, tinted), exchange tag (NSE/BSE), product tag (MTF/CNC), count badge. All mono, tinted per semantic.
- **Card** — `surface`, `border-strong`, `radius-2xl`, optional `shadow-card`. Danger card uses `neg-ring` border + `neg` tint.
- **Toggle / Switch** — Radix Switch; track `surface-2` → `pos` when on; 44px hit area. Read vs Place-Order permissions.
- **Select** — Radix Select; provider & model pickers. Mono for model names.
- **Input / Textarea** — `surface-2`, `border-strong`, focus → `border-focus`. Numeric fields mono, centered. Password field for API keys.
- **Tabs** — settings segmented control (pill container, active = `surface`/gold text); log filters (scrollable on mobile).
- **Nav item** — sidebar (icon + label, active = gold tint bg + `fg`) and mobile tab (icon + micro label + optional dot badge).
- **Breadcrumb** — clickable crumb (`fg-muted` → `fg` hover) + ghost chevron + current (`fg`).
- **Message bubble** — user (gold-tint, right) vs assistant (surface, left) + typing indicator (3 pulsing dots).
- **Modal / Dialog** — Radix Dialog; confirm destructive actions (cancel GTTs, reset logs, reject all, logout). Neutral vs destructive tone.
- **Toast** — transient confirmation ("Settings saved → PATCH /api/settings").
- **Data table** — desktop grid (holdings 10-col, GTT); horizontal-scroll wrapper; mobile → card list.
- **Status dot** — pulsing, semantic-colored, `glow-status`.

---

## 7. Accessibility & semantics

- Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>` (see handoff.md §6). No `<div>` soup.
- Focus-visible ring on every interactive element (`border-focus` / `ring-gold`).
- Color is never the only signal — pair with icon or text (e.g. breach badge has label + red).
- Decorative layers (`aria-hidden`), pointer-events none.
- Contrast: primary text `#efece4` on `#0a0a0a` ≈ 15:1; muted `#9a9a9a` ≈ 6:1 — keep helper text ≥ `fg-dim`.
- `prefers-reduced-motion`: freeze ambient wave/breathe, keep instant state changes.

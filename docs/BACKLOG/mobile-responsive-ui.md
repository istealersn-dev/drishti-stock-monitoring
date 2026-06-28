# Mobile Responsive UI

## Problem
The React dashboard is built for desktop only. On a phone it is unusable —
tables overflow, cards clip, and touch targets are too small. Slack is the
primary mobile interface today, but the dashboard has no mobile story.

## What to build
Adapt the existing dashboard layout to be usable on a mobile browser (primarily
iOS Safari, since the user is on Apple hardware). Not a native app — responsive
web only.

## Key breakpoints
- Desktop: ≥1024px — current layout unchanged
- Tablet: 768–1023px — minor column adjustments
- Mobile: <768px — single column, stacked cards

## Areas needing the most work

### Holdings table
Tables do not reflow well. On mobile, convert to a card-per-holding layout
showing symbol, LTP, P&L, and a disclosure chevron for the rest.

### Navigation
Sidebar or top nav should collapse to a bottom tab bar or hamburger on mobile.

### Stock config inline editor
Form inputs need larger touch targets and a full-screen edit flow rather than
inline row editing.

### GTT panel and approval cards
Already card-based — mostly needs padding/font-size tweaks and ensuring buttons
are at least 44px tall.

## Design system
All components must continue to use only design tokens from the Drishti design
system — no new one-off values. The token set already has appropriate spacing
and type scales to support a mobile layout.

## Why it matters
The user monitors the portfolio throughout the day. Being able to glance at
holdings, P&L, and active GTTs from a phone without opening Slack commands
is a meaningful quality-of-life improvement.

/**
 * Typed mirror of the CSS custom properties defined in `app.css`'s new
 * `@theme` block. For non-CSS consumers only (canvas drawing, computed
 * chart colors) — components should use Tailwind token classes directly,
 * never this object, per the no-inline-style guardrail.
 *
 * Keep in sync with project/Design.md and the `@theme` block in app.css.
 */
export const tokens = {
  color: {
    bgBase: "#0a0a0a",
    bgChrome: "#0d0d0c",
    surface: "#161513",
    surface2: "#131210",
    surface3: "#121110",
    surfaceInput: "#151412",
    surfaceHover: "#1b1a17",
    border: "#242320",
    borderStrong: "#2b2925",
    borderMuted: "#2a2825",
    borderFocus: "#c8a24a",
    fg: "#efece4",
    fgSoft: "#e6e2d8",
    fgMuted: "#9a9a9a",
    fgDim: "#8a8a8a",
    fgFaint: "#6a6a6a",
    fgGhost: "#4a463e",
    gold: "#c8a24a",
    goldDeep: "#9a7a2e",
    goldBright: "#e2c584",
    goldTint: "#ecd5a0",
    goldLine: "#cbb460",
    pos: "#22c55e",
    neg: "#ef4444",
    negSoft: "#f87171",
    warn: "#f59e0b",
    info: "#93b0f7",
  },
  radius: {
    xs: 5,
    sm: 6,
    md: 7,
    lg: 8,
    xl: 9,
    "2xl": 11,
    "3xl": 14,
    pill: 999,
  },
  fontSize: {
    display: 35,
    h1: 22,
    title: 18,
    subtitle: 15,
    body: 13.5,
    bodySm: 12.5,
    caption: 11.5,
    micro: 10.5,
    eyebrow: 10.5,
  },
  motion: {
    waveXMs: 17_000,
    waveYMs: 22_000,
    breatheMs: 17_000,
    pulseMs: 2_400,
    spinMs: 650,
    fadeMs: 200,
  },
  breakpoint: {
    nav: 760,
    loginSplit: 820,
  },
} as const;

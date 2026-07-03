import type React from "react";

import { tokens } from "../tokens/tokens";

type SwatchProperties = {
  label: string;
  hex: string;
  swatchClassName: string;
};

function Swatch({ label, hex, swatchClassName }: SwatchProperties): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
      <div
        className={`h-9 w-9 flex-none rounded-md border border-border-strong ${swatchClassName}`}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-body-sm font-medium text-fg">{label}</span>
        <span className="font-mono text-caption text-fg-faint">{hex}</span>
      </div>
    </div>
  );
}

type SectionProperties = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProperties): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

type ColorGroup = {
  title: string;
  swatches: { label: string; hex: string; swatchClassName: string }[];
};

const COLOR_GROUPS: ColorGroup[] = [
  {
    title: "Surfaces",
    swatches: [
      { label: "bg-base", hex: tokens.color.bgBase, swatchClassName: "bg-bg-base" },
      { label: "bg-chrome", hex: tokens.color.bgChrome, swatchClassName: "bg-bg-chrome" },
      { label: "surface", hex: tokens.color.surface, swatchClassName: "bg-surface" },
      { label: "surface-2", hex: tokens.color.surface2, swatchClassName: "bg-surface-2" },
      { label: "surface-3", hex: tokens.color.surface3, swatchClassName: "bg-surface-3" },
      {
        label: "surface-input",
        hex: tokens.color.surfaceInput,
        swatchClassName: "bg-surface-input",
      },
      {
        label: "surface-hover",
        hex: tokens.color.surfaceHover,
        swatchClassName: "bg-surface-hover",
      },
    ],
  },
  {
    title: "Borders",
    swatches: [
      { label: "border", hex: tokens.color.border, swatchClassName: "bg-border" },
      {
        label: "border-strong",
        hex: tokens.color.borderStrong,
        swatchClassName: "bg-border-strong",
      },
      {
        label: "border-muted",
        hex: tokens.color.borderMuted,
        swatchClassName: "bg-border-muted",
      },
      {
        label: "border-focus",
        hex: tokens.color.borderFocus,
        swatchClassName: "bg-border-focus",
      },
    ],
  },
  {
    title: "Text",
    swatches: [
      { label: "fg", hex: tokens.color.fg, swatchClassName: "bg-fg" },
      { label: "fg-soft", hex: tokens.color.fgSoft, swatchClassName: "bg-fg-soft" },
      { label: "fg-muted", hex: tokens.color.fgMuted, swatchClassName: "bg-fg-muted" },
      { label: "fg-dim", hex: tokens.color.fgDim, swatchClassName: "bg-fg-dim" },
      { label: "fg-faint", hex: tokens.color.fgFaint, swatchClassName: "bg-fg-faint" },
      { label: "fg-ghost", hex: tokens.color.fgGhost, swatchClassName: "bg-fg-ghost" },
    ],
  },
  {
    title: "Brand (gold)",
    swatches: [
      { label: "gold", hex: tokens.color.gold, swatchClassName: "bg-gold" },
      { label: "gold-deep", hex: tokens.color.goldDeep, swatchClassName: "bg-gold-deep" },
      { label: "gold-bright", hex: tokens.color.goldBright, swatchClassName: "bg-gold-bright" },
      { label: "gold-tint", hex: tokens.color.goldTint, swatchClassName: "bg-gold-tint" },
      { label: "gold-line", hex: tokens.color.goldLine, swatchClassName: "bg-gold-line" },
    ],
  },
  {
    title: "Semantic",
    swatches: [
      { label: "pos", hex: tokens.color.pos, swatchClassName: "bg-pos" },
      { label: "neg", hex: tokens.color.neg, swatchClassName: "bg-neg" },
      { label: "neg-soft", hex: tokens.color.negSoft, swatchClassName: "bg-neg-soft" },
      { label: "warn", hex: tokens.color.warn, swatchClassName: "bg-warn" },
      { label: "info", hex: tokens.color.info, swatchClassName: "bg-info" },
    ],
  },
];

const RADIUS_SWATCHES = [
  { label: "xs", value: tokens.radius.xs, className: "rounded-xs" },
  { label: "sm", value: tokens.radius.sm, className: "rounded-sm" },
  { label: "md", value: tokens.radius.md, className: "rounded-md" },
  { label: "lg", value: tokens.radius.lg, className: "rounded-lg" },
  { label: "xl", value: tokens.radius.xl, className: "rounded-xl" },
  { label: "2xl", value: tokens.radius["2xl"], className: "rounded-2xl" },
  { label: "3xl", value: tokens.radius["3xl"], className: "rounded-3xl" },
  { label: "pill", value: tokens.radius.pill, className: "rounded-pill" },
];

const TYPE_SCALE = [
  { label: "display", size: tokens.fontSize.display, className: "text-display" },
  { label: "h1", size: tokens.fontSize.h1, className: "text-h1" },
  { label: "title", size: tokens.fontSize.title, className: "text-title" },
  { label: "subtitle", size: tokens.fontSize.subtitle, className: "text-subtitle" },
  { label: "body", size: tokens.fontSize.body, className: "text-body" },
  { label: "body-sm", size: tokens.fontSize.bodySm, className: "text-body-sm" },
  { label: "caption", size: tokens.fontSize.caption, className: "text-caption" },
  { label: "micro", size: tokens.fontSize.micro, className: "text-micro" },
  { label: "eyebrow", size: tokens.fontSize.eyebrow, className: "text-eyebrow uppercase" },
];

const SHADOW_SWATCHES = [
  { label: "shadow-card", className: "shadow-card" },
  { label: "shadow-gold", className: "shadow-gold" },
  { label: "shadow-ring-gold", className: "shadow-ring-gold" },
  { label: "shadow-glow-pos", className: "shadow-glow-pos" },
  { label: "shadow-glow-neg", className: "shadow-glow-neg" },
  { label: "shadow-glow-warn", className: "shadow-glow-warn" },
  { label: "shadow-glow-info", className: "shadow-glow-info" },
];

const MOTION_SAMPLES = [
  { label: "pulse", className: "animate-pulse", durationMs: tokens.motion.pulseMs },
  { label: "spin", className: "animate-spin", durationMs: tokens.motion.spinMs },
  { label: "breathe", className: "animate-breathe", durationMs: tokens.motion.breatheMs },
  { label: "fade", className: "animate-fade", durationMs: tokens.motion.fadeMs },
];

/**
 * Design-system compliance page — renders every Design.md token as a live
 * swatch, built only with the new token-bound Tailwind classes. Serves as
 * both documentation and a visual regression check for CP1.
 * @returns Tokens preview page element
 */
export function TokensPreview(): React.ReactElement {
  return (
    <main className="flex min-h-dvh flex-col gap-8 bg-bg-base p-8 font-sans text-fg">
      <header className="flex flex-col gap-1">
        <h1 className="text-display font-semibold text-fg">Drishti design tokens</h1>
        <p className="text-body text-fg-muted">
          Every token from project/Design.md, rendered live for visual verification.
        </p>
      </header>

      {COLOR_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {group.swatches.map((s) => (
              <Swatch
                key={s.label}
                label={s.label}
                hex={s.hex}
                swatchClassName={s.swatchClassName}
              />
            ))}
          </div>
          {group.title === "Brand (gold)" && (
            <div className="flex h-9 w-32 items-center justify-center rounded-md font-mono text-caption text-fg shadow-gold [background-image:var(--gradient-gold)]">
              gradient-gold
            </div>
          )}
          {group.title === "Semantic" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-pos-ring bg-pos-tint p-3 text-body-sm text-pos">
                pos-tint / pos-ring
              </div>
              <div className="rounded-lg border border-neg-ring bg-neg-tint p-3 text-body-sm text-neg">
                neg-tint / neg-ring
              </div>
              <div className="rounded-lg border border-warn-ring bg-warn-tint p-3 text-body-sm text-warn">
                warn-tint / warn-ring
              </div>
              <div className="rounded-lg border border-info-ring bg-info-tint p-3 text-body-sm text-info">
                info-tint / info-ring
              </div>
            </div>
          )}
        </Section>
      ))}

      <Section title="Radius">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RADIUS_SWATCHES.map((r) => (
            <div
              key={r.label}
              className={`flex h-16 flex-col items-center justify-center gap-1 border border-border-strong bg-surface-2 ${r.className}`}
            >
              <span className="text-body-sm font-medium text-fg">{r.label}</span>
              <span className="font-mono text-caption text-fg-faint">{r.value}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="flex flex-col gap-2">
          {TYPE_SCALE.map((t) => (
            <div key={t.label} className="flex items-baseline gap-4">
              <span className="w-24 flex-none font-mono text-caption text-fg-faint">
                {t.label} · {t.size}px
              </span>
              <span className={`${t.className} text-fg`}>The quick brown fox</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevation">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {SHADOW_SWATCHES.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div
                className={`h-12 w-12 rounded-2xl border border-border-strong bg-surface ${s.className}`}
              />
              <span className="text-center font-mono text-caption text-fg-faint">{s.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <p className="text-caption text-fg-dim">
          Ambient loops (wave-x, wave-y, breathe) use `alternate` direction with negative delays so
          they never reset on re-render — see project/Design.md §4.
        </p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {MOTION_SAMPLES.map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-2">
              <div className={`h-8 w-8 rounded-full bg-gold ${m.className}`} />
              <span className="text-center font-mono text-caption text-fg-faint">
                {m.label} · {m.durationMs}ms
              </span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-surface-2">
              <div className="absolute inset-0 animate-wave-x rounded-full bg-gold-line" />
            </div>
            <span className="text-center font-mono text-caption text-fg-faint">
              wave-x · {tokens.motion.waveXMs}ms
            </span>
          </div>
        </div>
      </Section>
    </main>
  );
}

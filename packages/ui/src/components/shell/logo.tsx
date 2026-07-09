import type React from "react";

const DEFAULT_CLASS = "h-7 w-7 rounded-lg text-body-sm";

type LogoProperties = {
  /** Sizing/shape classes (height, width, rounded-*, text-*) — the gradient, glow,
   * glyph, and sheen animation are fixed. Defaults to the sidebar/header size. */
  className?: string;
};

/**
 * Drishti's brand mark — extracted from the "Drishti Landing.dc.html" design
 * (dark radial badge, gold ring + glow, animated gold-sheen தி glyph),
 * replacing the flat gold-square + Devanagari दृ badge every shell surface
 * previously re-implemented individually (sidebar, mobile header, login,
 * Ask Drishti breadcrumb, chat avatar).
 * @param props.className - Sizing/shape override; see DEFAULT_CLASS for the default.
 * @returns Logo badge element
 */
export function Logo({ className = DEFAULT_CLASS }: LogoProperties): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center bg-[image:var(--gradient-logo-badge)] shadow-ring-glow-gold ${className}`}
    >
      <span className="animate-sheen bg-[image:var(--gradient-gold-sheen)] bg-[length:260%_100%] bg-clip-text font-tamil font-bold text-transparent">
        தி
      </span>
    </span>
  );
}

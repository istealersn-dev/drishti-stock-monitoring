import { forwardRef } from "react";
import type React from "react";

type BadgeVariant = "pos" | "neg" | "warn" | "info" | "neutral";

type BadgeProperties = {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
};

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  pos: "bg-pos-tint text-pos border-pos-ring",
  neg: "bg-neg-tint text-neg border-neg-ring",
  warn: "bg-warn-tint text-warn border-warn-ring",
  info: "bg-info-tint text-info border-info-ring",
  neutral: "bg-surface-2 text-fg-muted border-border-strong",
};

const DOT_CLASS: Record<BadgeVariant, string> = {
  pos: "bg-pos",
  neg: "bg-neg",
  warn: "bg-warn",
  info: "bg-info",
  neutral: "bg-fg-muted",
};

/**
 * Tinted status/tag pill (Design.md §6) — covers status pills, exchange tags
 * (NSE/BSE), product tags (MTF/CNC), and count badges via `variant` + `dot`.
 * @param props.variant - semantic tint (default: neutral)
 * @param props.dot - show a small status dot before the label
 * @param props.children - badge label (mono, per spec)
 * @param props.className - additional classes
 * @returns Badge element
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProperties>(function Badge(
  { variant = "neutral", dot = false, children, className = "" },
  ref,
): React.ReactElement {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 font-mono text-micro font-medium ${VARIANT_CLASS[variant]} ${className}`}
    >
      {dot && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[variant]}`} />
      )}
      {children}
    </span>
  );
});

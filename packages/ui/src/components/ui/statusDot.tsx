import type React from "react";

type StatusDotVariant = "pos" | "neg" | "warn" | "info";

type StatusDotProperties = {
  variant: StatusDotVariant;
  label: string;
  pulse?: boolean;
  className?: string;
};

const VARIANT_CLASS: Record<StatusDotVariant, string> = {
  pos: "bg-pos shadow-glow-pos",
  neg: "bg-neg shadow-glow-neg",
  warn: "bg-warn shadow-glow-warn",
  info: "bg-info shadow-glow-info",
};

/**
 * Pulsing, semantic-colored status indicator (Design.md §6). `label` is
 * required and rendered as visually-hidden text — color is never the only
 * signal (Design.md §7).
 * @param props.variant - semantic color
 * @param props.label - accessible description of the status (e.g. "Connected")
 * @param props.pulse - animate with the glow-status pulse (default: true)
 * @param props.className - additional classes
 * @returns Status dot element
 */
export function StatusDot({
  variant,
  label,
  pulse = true,
  className = "",
}: StatusDotProperties): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 flex-none rounded-full ${VARIANT_CLASS[variant]} ${pulse ? "animate-pulse" : ""} ${className}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

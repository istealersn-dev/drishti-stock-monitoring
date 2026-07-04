import type React from "react";

type SpinnerSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

type SpinnerProperties = {
  size?: SpinnerSize;
};

/**
 * Loading spinner (Design.md §6) — a token-colored spinning ring for
 * page-level loading states, shared so a single source of truth governs the
 * color/border tokens instead of every page re-implementing it inline.
 * @param props.size - spinner diameter (default: md)
 * @returns Spinner element
 */
export function Spinner({ size = "md" }: SpinnerProperties): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-border-strong border-t-gold ${SIZE_CLASS[size]}`}
    />
  );
}

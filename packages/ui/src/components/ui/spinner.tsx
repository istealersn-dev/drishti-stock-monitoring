import React from "react";

type SpinnerProperties = {
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<SpinnerProperties["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

/**
 * Spinning loader indicator using the design-token animation class.
 * @param props.size - Spinner size (default: md)
 * @returns Spinner element
 */
export function Spinner({ size = "md" }: SpinnerProperties): React.ReactElement {
  return (
    <span
      className={`inline-block animate-spin-drk rounded-full border-2 border-border-default border-t-primary-text ${SIZE_CLASS[size]}`}
      aria-label="Loading"
    />
  );
}

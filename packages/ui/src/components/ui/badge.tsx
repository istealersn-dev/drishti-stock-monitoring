import React from "react";

type BadgeVariant = "success" | "danger" | "warning" | "default" | "primary";

type BadgeProperties = {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success-text border border-success/20",
  danger: "bg-danger/10 text-danger-text border border-danger/30",
  warning: "bg-warning/10 text-warning border border-warning/40",
  primary: "bg-primary-bg text-primary-text border border-primary-border",
  default: "bg-bg-inset text-text-muted border border-border-dim",
};

const DOT_VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  primary: "bg-primary",
  default: "bg-text-muted",
};

/**
 * Small status badge / pill component.
 * @param props.variant - Color variant (default: default)
 * @param props.dot - Show a pulsing dot indicator
 * @param props.children - Badge label content
 * @returns Badge element
 */
export function Badge({
  variant = "default",
  dot = false,
  children,
}: BadgeProperties): React.ReactElement {
  return (
    <span className={`badge-pill ${VARIANT_CLASSES[variant]}`}>
      {dot && (
        <span
          className={`inline-block h-1.5 w-1.5 animate-blink-drk rounded-full ${DOT_VARIANT_CLASSES[variant]}`}
        />
      )}
      {children}
    </span>
  );
}

import type React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

type ButtonBaseProperties = {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
};

type ButtonProperties =
  | (ButtonBaseProperties & { variant?: ButtonVariant })
  | (ButtonBaseProperties & { variant: "icon"; "aria-label": string });

const VARIANT_CLASS: Record<ButtonVariant | "icon", string> = {
  primary:
    "px-4 py-2 rounded-xl bg-[image:var(--gradient-gold)] text-bg-base shadow-gold hover:brightness-110 active:brightness-95",
  secondary:
    "px-4 py-2 rounded-xl border border-border-strong text-fg hover:border-border-muted hover:bg-surface-hover",
  ghost: "px-4 py-2 rounded-xl text-fg-muted hover:bg-surface-hover hover:text-fg",
  destructive:
    "px-4 py-2 rounded-xl border border-neg-ring bg-neg-tint text-neg-soft hover:brightness-110",
  icon: "h-8 w-8 rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg",
};

/**
 * Primary interactive control (Design.md §6). `variant: "icon"` renders a square
 * 32px hit target and requires `aria-label` since it carries no visible text.
 * @param props - button configuration; `variant` selects the visual treatment
 * @returns Button element
 */
export function Button(props: ButtonProperties): React.ReactElement {
  const { type = "button", disabled = false, onClick, className = "", children } = props;
  const variant = props.variant ?? "secondary";
  const ariaLabel = props.variant === "icon" ? props["aria-label"] : undefined;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[image:none] disabled:bg-surface-2 disabled:text-fg-faint disabled:shadow-none ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

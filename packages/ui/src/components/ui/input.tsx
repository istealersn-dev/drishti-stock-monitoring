import type React from "react";

type InputProperties = {
  id: string;
  label: string;
  hideLabel?: boolean;
  type?: "text" | "number" | "password" | "email";
  numeric?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Labelled text input (Design.md §6) — always paired with a `<label for>`
 * (visually hidden via `hideLabel` when a design already shows the label
 * elsewhere, but never omitted from the DOM). `numeric` applies mono,
 * centered text for price/qty fields.
 * @param props.id - element id, shared with the generated label's `for`
 * @param props.label - accessible label text
 * @param props.hideLabel - visually hide the label (sr-only), keep it in the DOM
 * @param props.type - native input type (default: text)
 * @param props.numeric - mono + centered text treatment for numeric fields
 * @param props.value - controlled value
 * @param props.onChange - change handler, receives the new string value
 * @param props.placeholder - placeholder text
 * @param props.disabled - disables the input
 * @param props.className - additional classes on the input element
 * @returns Labelled input element
 */
export function Input({
  id,
  label,
  hideLabel = false,
  type = "text",
  numeric = false,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
}: InputProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-caption text-fg-muted"}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event): void => onChange(event.target.value)}
        className={`h-10 rounded-lg border border-border-strong bg-surface-2 px-3 text-body text-fg outline-none transition-colors placeholder:text-fg-faint focus-visible:border-border-focus disabled:cursor-not-allowed disabled:text-fg-faint ${numeric ? "text-center font-mono tabular-nums" : ""} ${className}`}
      />
    </div>
  );
}

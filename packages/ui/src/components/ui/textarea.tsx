import type React from "react";

type TextareaProperties = {
  id: string;
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
};

/**
 * Labelled multi-line text input (Design.md §6), same label/token treatment
 * as Input.
 * @param props.id - element id, shared with the generated label's `for`
 * @param props.label - accessible label text
 * @param props.hideLabel - visually hide the label (sr-only), keep it in the DOM
 * @param props.value - controlled value
 * @param props.onChange - change handler, receives the new string value
 * @param props.placeholder - placeholder text
 * @param props.disabled - disables the textarea
 * @param props.rows - visible row count (default: 3)
 * @param props.className - additional classes on the textarea element
 * @returns Labelled textarea element
 */
export function Textarea({
  id,
  label,
  hideLabel = false,
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
  className = "",
}: TextareaProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-caption text-fg-muted"}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event): void => onChange(event.target.value)}
        className={`resize-y rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-subtitle text-fg outline-none transition-colors placeholder:text-fg-faint focus-visible:border-border-focus disabled:cursor-not-allowed disabled:text-fg-faint ${className}`}
      />
    </div>
  );
}

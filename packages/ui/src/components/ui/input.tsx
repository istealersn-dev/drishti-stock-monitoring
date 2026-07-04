import { Eye, EyeOff } from "lucide-react";
import type React from "react";
import { useState } from "react";

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
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
  autoFocus?: boolean;
  className?: string;
};

/**
 * Labelled text input (Design.md §6) — always paired with a `<label for>`
 * (visually hidden via `hideLabel` when a design already shows the label
 * elsewhere, but never omitted from the DOM). `numeric` applies mono,
 * centered text for price/qty fields. `type="password"` (API keys) gets a
 * reveal toggle, laid out as a flex sibling of the field rather than an
 * absolutely-positioned overlay.
 * @param props.id - element id, shared with the generated label's `for`
 * @param props.label - accessible label text
 * @param props.hideLabel - visually hide the label (sr-only), keep it in the DOM
 * @param props.type - native input type (default: text)
 * @param props.numeric - mono + centered text treatment for numeric fields
 * @param props.value - controlled value
 * @param props.onChange - change handler, receives the new string value
 * @param props.placeholder - placeholder text
 * @param props.disabled - disables the input
 * @param props.autoComplete - native autocomplete hint (e.g. "current-password")
 * @param props.autoFocus - focus the field on mount
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
  autoComplete,
  autoFocus = false,
  className = "",
}: InputProperties): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const fieldType = isPassword && revealed ? "text" : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-caption text-fg-muted"}>
        {label}
      </label>
      <div
        className={`flex items-center rounded-lg border border-border-strong bg-surface-2 transition-colors focus-within:border-border-focus ${className}`}
      >
        <input
          id={id}
          type={fieldType}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(event): void => onChange(event.target.value)}
          className={`h-10 min-w-0 flex-1 bg-transparent px-3 text-body text-fg outline-none placeholder:text-fg-faint disabled:cursor-not-allowed disabled:text-fg-faint ${numeric ? "text-center font-mono tabular-nums" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={(): void => setRevealed((current) => !current)}
            disabled={disabled}
            aria-label={revealed ? "Hide value" : "Show value"}
            className="flex h-10 w-10 flex-none items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:text-fg-faint"
          >
            {revealed ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type React from "react";

type SwitchProperties = {
  id: string;
  label: string;
  hideLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Labelled toggle (Design.md §6) — track is surface-2, turns pos when on.
 * The clickable Root is a genuine 44×44px hit area (Design.md's touch-target
 * minimum applies to both axes, not just width); the visible track is a
 * slimmer 24px-tall pill centered inside it via flex, not position:absolute.
 * Always paired with a `<label for>` (e.g. broker Read/Place-Order
 * permissions).
 * @param props.id - element id, shared with the label's `for`
 * @param props.label - accessible label text
 * @param props.hideLabel - visually hide the label (sr-only), keep it in the DOM
 * @param props.checked - controlled checked state
 * @param props.onChange - change handler, receives the new checked state
 * @param props.disabled - disables the switch
 * @param props.className - additional classes on the visible track
 * @returns Labelled switch element
 */
export function Switch({
  id,
  label,
  hideLabel = false,
  checked,
  onChange,
  disabled = false,
  className = "",
}: SwitchProperties): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="flex h-11 w-11 flex-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`pointer-events-none block h-6 w-11 rounded-pill transition-colors ${checked ? "bg-pos" : "bg-surface-2"} ${className}`}
        >
          <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-5" />
        </span>
      </SwitchPrimitive.Root>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-body-sm text-fg"}>
        {label}
      </label>
    </div>
  );
}

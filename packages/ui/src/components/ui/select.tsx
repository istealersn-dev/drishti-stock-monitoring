import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type React from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProperties = {
  id: string;
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  className?: string;
};

/**
 * Radix-backed select (Design.md §6) — provider/model pickers. `mono`
 * applies JetBrains Mono to option labels for model names.
 * @param props.id - trigger element id, shared with the generated label's `for`
 * @param props.label - accessible label text
 * @param props.hideLabel - visually hide the label (sr-only), keep it in the DOM
 * @param props.value - controlled selected value
 * @param props.onChange - change handler, receives the newly selected value
 * @param props.options - selectable options
 * @param props.placeholder - shown when no value is selected
 * @param props.disabled - disables the select
 * @param props.mono - render option labels in JetBrains Mono (model names)
 * @param props.className - additional classes on the trigger
 * @returns Labelled select element
 */
export function Select({
  id,
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  mono = false,
  className = "",
}: SelectProperties): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-caption text-fg-muted"}>
        {label}
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          className={`flex h-10 items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 text-body text-fg outline-none transition-colors focus-visible:border-border-focus disabled:cursor-not-allowed disabled:text-fg-faint ${mono ? "font-mono" : ""} ${className}`}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-fg-muted" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-lg border border-border-strong bg-surface shadow-card"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-body-sm text-fg outline-none data-[highlighted]:bg-surface-hover ${mono ? "font-mono" : ""}`}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-gold" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

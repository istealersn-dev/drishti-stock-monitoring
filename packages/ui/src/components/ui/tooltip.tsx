import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";

type TooltipProperties = {
  content: string;
  children: React.ReactElement;
};

/**
 * Radix-backed tooltip. Wraps `children` (must accept a ref/forward it, e.g.
 * a Button) and shows `content` on hover/focus after a short delay.
 * @param props.content - tooltip text
 * @param props.children - the single trigger element
 * @returns Tooltip-wrapped trigger
 */
export function Tooltip({ content, children }: TooltipProperties): React.ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 rounded-md border border-border-strong bg-surface px-2 py-1 text-caption text-fg shadow-card data-[state=delayed-open]:animate-fade"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

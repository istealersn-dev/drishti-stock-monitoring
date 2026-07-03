import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type React from "react";

type ScrollAreaProperties = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
};

/**
 * Radix-backed scroll container with token-styled scrollbars — used for
 * the Ask Drishti message list and other overflow regions.
 * @param props.children - scrollable content
 * @param props.className - classes on the outer root (controls sizing)
 * @param props.viewportClassName - additional classes on the inner viewport
 * @returns Scroll area element
 */
export function ScrollArea({
  children,
  className = "",
  viewportClassName = "",
}: ScrollAreaProperties): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root className={`overflow-hidden ${className}`}>
      <ScrollAreaPrimitive.Viewport className={`h-full w-full ${viewportClassName}`}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none select-none bg-transparent p-0.5"
      >
        <ScrollAreaPrimitive.Thumb className="flex-1 rounded-pill bg-border-strong" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex h-2 touch-none select-none bg-transparent p-0.5"
      >
        <ScrollAreaPrimitive.Thumb className="flex-1 rounded-pill bg-border-strong" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

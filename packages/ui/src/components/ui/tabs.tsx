import * as TabsPrimitive from "@radix-ui/react-tabs";
import type React from "react";

type TabsRootProperties = {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

function TabsRoot({
  value,
  onChange,
  children,
  className = "",
}: TabsRootProperties): React.ReactElement {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange} className={className}>
      {children}
    </TabsPrimitive.Root>
  );
}

type TabsListProperties = {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
};

function TabsList({
  children,
  scrollable = false,
  className = "",
}: TabsListProperties): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-3 p-1 ${scrollable ? "max-w-full overflow-x-auto" : ""} ${className}`}
    >
      {children}
    </TabsPrimitive.List>
  );
}

type TabsTriggerProperties = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

function TabsTrigger({
  value,
  children,
  className = "",
}: TabsTriggerProperties): React.ReactElement {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-body-sm font-medium text-fg-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold data-[state=active]:bg-gold/[0.16] data-[state=active]:text-gold ${className}`}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

type TabsContentProperties = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

function TabsContent({
  value,
  children,
  className = "",
}: TabsContentProperties): React.ReactElement {
  return (
    <TabsPrimitive.Content value={value} className={className}>
      {children}
    </TabsPrimitive.Content>
  );
}

/**
 * Radix-backed tabs (Design.md §6) — pill segmented control (Settings) or
 * scrollable variant (log filters on mobile via `List`'s `scrollable` prop).
 * Compound component: `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`.
 * @returns Tabs root wrapping Radix Tabs.Root
 */
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

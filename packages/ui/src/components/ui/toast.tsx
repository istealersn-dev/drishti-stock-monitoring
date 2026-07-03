import * as ToastPrimitive from "@radix-ui/react-toast";
import type React from "react";

type ToastProviderProperties = {
  children: React.ReactNode;
};

function ToastProvider({ children }: ToastProviderProperties): React.ReactElement {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}

type ToastRootProperties = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
};

function ToastRoot({
  open,
  onOpenChange,
  title,
  description,
  className = "",
}: ToastRootProperties): React.ReactElement {
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      className={`flex flex-col gap-0.5 rounded-xl border border-border-strong bg-surface p-3 shadow-card data-[state=open]:animate-fade ${className}`}
    >
      <ToastPrimitive.Title className="text-body-sm font-medium text-fg">
        {title}
      </ToastPrimitive.Title>
      {description !== undefined && (
        <ToastPrimitive.Description className="text-caption text-fg-muted">
          {description}
        </ToastPrimitive.Description>
      )}
    </ToastPrimitive.Root>
  );
}

/**
 * Radix-backed transient confirmation toast (Design.md §6, e.g. "Settings
 * saved"). `Toast.Provider` wraps the app once (wired in CP4's AppShell);
 * `Toast` itself is one instance. Compound component: `Toast.Provider`.
 * @returns Toast root wrapping Radix Toast.Root
 */
export const Toast = Object.assign(ToastRoot, {
  Provider: ToastProvider,
});

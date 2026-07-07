import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type React from "react";

// Shared with MobileTabBar's bottom sheet (a second, differently-shaped
// Radix Dialog consumer) so the two surfaces can't drift on the overlay's
// scrim color/fade treatment.
export const DIALOG_OVERLAY_CLASS_NAME =
  "fixed inset-0 z-40 bg-[color:rgb(10_10_10_/_0.7)] data-[state=open]:animate-fade";

type DialogRootProperties = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function DialogRoot({ open, onOpenChange, children }: DialogRootProperties): React.ReactElement {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

type DialogTriggerProperties = {
  children: React.ReactElement;
};

function DialogTrigger({ children }: DialogTriggerProperties): React.ReactElement {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>;
}

type DialogContentProperties = {
  title: string;
  description?: string;
  tone?: "neutral" | "destructive";
  children: React.ReactNode;
  className?: string;
};

function DialogContent({
  title,
  description,
  tone = "neutral",
  children,
  className = "",
}: DialogContentProperties): React.ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay aria-hidden="true" className={DIALOG_OVERLAY_CLASS_NAME} />
      <DialogPrimitive.Content
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-card outline-none data-[state=open]:animate-fade ${tone === "destructive" ? "border-neg-ring bg-neg-tint" : "border-border-strong bg-surface"} ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogPrimitive.Title className="text-title font-semibold text-fg">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {description !== undefined && (
          <DialogPrimitive.Description className="mt-1 text-body-sm text-fg-muted">
            {description}
          </DialogPrimitive.Description>
        )}
        <div className="mt-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

type DialogFooterProperties = {
  children: React.ReactNode;
  className?: string;
};

function DialogFooter({ children, className = "" }: DialogFooterProperties): React.ReactElement {
  return <div className={`mt-5 flex justify-end gap-2 ${className}`}>{children}</div>;
}

/**
 * Radix-backed modal (Design.md §6) — confirms destructive actions (cancel
 * GTTs, reset logs, reject all, logout). `tone="destructive"` applies the
 * neg-tint/neg-ring treatment; overlay/content use `fixed` positioning,
 * a genuine overlay per Design.md §5's carve-out for Radix popovers/modals.
 * Compound component: `Dialog.Trigger`, `Dialog.Content`, `Dialog.Footer`.
 * @returns Dialog root wrapping Radix Dialog.Root
 */
export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Footer: DialogFooter,
});

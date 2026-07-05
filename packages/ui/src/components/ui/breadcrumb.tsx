import { ChevronRight } from "lucide-react";
import type React from "react";

type BreadcrumbItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type BreadcrumbProperties = {
  items: BreadcrumbItem[];
  className?: string;
};

/**
 * Breadcrumb trail (Design.md §6) — clickable crumbs with a ghost chevron
 * separator; the last item is the current page (`aria-current="page"`, not
 * a link even if it has an `href`). A non-current item with `onClick` (and
 * no `href`) renders as a `<button>` instead of an `<a>` — for crumbs that
 * reset local view state rather than navigate to a URL (e.g. Ask Drishti's
 * "return to the empty hero" crumb, per Design.md §5).
 * @param props.items - ordered crumbs, first to last (current page last)
 * @param props.className - additional classes
 * @returns Breadcrumb nav element
 */
export function Breadcrumb({ items, className = "" }: BreadcrumbProperties): React.ReactElement {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-body-sm ${className}`}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-fg-ghost" />}
            {isCurrent ? (
              <span aria-current="page" className="text-fg">
                {item.label}
              </span>
            ) : item.href !== undefined ? (
              <a
                href={item.href}
                className="rounded text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {item.label}
              </a>
            ) : item.onClick !== undefined ? (
              <button
                type="button"
                onClick={item.onClick}
                className="cursor-pointer rounded text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-fg-muted">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

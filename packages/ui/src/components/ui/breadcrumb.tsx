import { ChevronRight } from "lucide-react";
import type React from "react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProperties = {
  items: BreadcrumbItem[];
  className?: string;
};

/**
 * Breadcrumb trail (Design.md §6) — clickable crumbs with a ghost chevron
 * separator; the last item is the current page (`aria-current="page"`, not
 * a link even if it has an `href`).
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
            {isCurrent || item.href === undefined ? (
              <span aria-current={isCurrent ? "page" : undefined} className="text-fg">
                {item.label}
              </span>
            ) : (
              <a href={item.href} className="text-fg-muted transition-colors hover:text-fg">
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}

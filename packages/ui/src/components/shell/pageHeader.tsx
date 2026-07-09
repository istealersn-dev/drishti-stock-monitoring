import type React from "react";

type PageHeaderProperties = {
  title: string;
  subtitle?: string;
};

/**
 * Page title (Design.md §3 type scale — `title` token, "Page title") shown at
 * the top of a page's own content. The desktop shell has no persistent header
 * (Design.md §5 — sidebar + footer only), so without this a page's content
 * starts flush against the top edge of `<main>` with no title or orientation.
 * @param props.title - The page name (e.g. "Dashboard")
 * @param props.subtitle - Optional one-line description shown beneath the title
 * @returns Page header element
 */
export function PageHeader({ title, subtitle }: PageHeaderProperties): React.ReactElement {
  return (
    <div>
      <h1 className="text-title font-semibold text-fg">{title}</h1>
      {subtitle && <p className="mt-1 text-body-sm text-fg-muted">{subtitle}</p>}
    </div>
  );
}

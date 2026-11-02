import { forwardRef } from "react";
import type React from "react";

type CardProperties = {
  as?: "div" | "article" | "section";
  danger?: boolean;
  shadow?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Visual grouping (Design.md §6). A plain `<div>` by default, since most cards
 * are just panels; pass `as` when the content really is a standalone article or
 * a labelled section. `danger` applies the neg-tint/neg-ring destructive
 * treatment (Danger Zone cards, expired approvals).
 * @param props.as - root element (default: div)
 * @param props.danger - destructive/danger-zone treatment
 * @param props.shadow - apply shadow-card elevation
 * @param props.children - card content
 * @param props.className - additional classes
 * @returns Card element
 */
export const Card = forwardRef<HTMLDivElement, CardProperties>(function Card(
  { as = "div", danger = false, shadow = false, children, className = "" },
  ref,
): React.ReactElement {
  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={`rounded-2xl border p-4 ${danger ? "border-neg-ring bg-neg-tint" : "border-border-strong bg-surface"} ${shadow ? "shadow-card" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
});

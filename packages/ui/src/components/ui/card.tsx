import type React from "react";

type CardProperties = {
  as?: "article" | "section";
  danger?: boolean;
  shadow?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Grouped content region (Design.md §6) — semantic `<article>`/`<section>`,
 * never a bare `<div>`. `danger` applies the neg-tint/neg-ring destructive
 * treatment (Danger Zone cards, expired approvals).
 * @param props.as - root element (default: article)
 * @param props.danger - destructive/danger-zone treatment
 * @param props.shadow - apply shadow-card elevation
 * @param props.children - card content
 * @param props.className - additional classes
 * @returns Card element
 */
export function Card({
  as = "article",
  danger = false,
  shadow = false,
  children,
  className = "",
}: CardProperties): React.ReactElement {
  const Tag = as;
  return (
    <Tag
      className={`rounded-2xl border p-4 ${danger ? "border-neg-ring bg-neg-tint" : "border-border-strong bg-surface"} ${shadow ? "shadow-card" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

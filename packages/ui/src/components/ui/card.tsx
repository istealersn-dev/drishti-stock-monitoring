import React from "react";

type CardAccent = "indigo" | "success" | "warning" | "danger" | "none";

type CardProperties = {
  accent?: CardAccent;
  padding?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Surface card with optional top-accent stripe matching the design system.
 * @param props.accent - Top accent stripe color (default: none)
 * @param props.padding - Apply standard 16px padding (default: true)
 * @param props.children - Card content
 * @param props.className - Additional classes
 * @returns Card container element
 */
export function Card({
  accent = "none",
  padding = true,
  children,
  className = "",
}: CardProperties): React.ReactElement {
  const accentClass = accent !== "none" ? `card-accent-${accent}` : "";
  return (
    <div className={`card ${accentClass} ${padding ? "p-4" : ""} ${className}`}>{children}</div>
  );
}

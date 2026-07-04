import type React from "react";

import { Card } from "../ui/card";

type StatAccent = "pos" | "neg" | "warn" | "info";

const ACCENT_BORDER_CLASS: Record<StatAccent, string> = {
  pos: "border-t-pos",
  neg: "border-t-neg",
  warn: "border-t-warn",
  info: "border-t-info",
};

type StatCardProperties = {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent: StatAccent;
};

/**
 * Dashboard stat card (Drishti.dc.html's stat-card, rebuilt on tokens) — a
 * 2px semantic-colored top border (not the prototype's `position:absolute`
 * gradient bar, per the mission's minimize-position constraint) marks each
 * card's tone.
 * @param props.label - stat name
 * @param props.value - the headline value (may include inline color/markup)
 * @param props.sub - supporting context line
 * @param props.accent - semantic tone for the top border
 * @returns Stat card element
 */
export function StatCard({ label, value, sub, accent }: StatCardProperties): React.ReactElement {
  return (
    <Card className={`flex flex-col gap-1.5 border-t-2 ${ACCENT_BORDER_CLASS[accent]}`}>
      <span className="text-caption text-fg-faint">{label}</span>
      <span className="font-mono text-title font-semibold tracking-tight text-fg">{value}</span>
      <span className="text-caption text-fg-muted">{sub}</span>
    </Card>
  );
}

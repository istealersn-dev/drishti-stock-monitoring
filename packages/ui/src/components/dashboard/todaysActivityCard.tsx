import type React from "react";

import { Card } from "../ui/card";

/**
 * Today's activity panel (updated design) — buys and sells executed today.
 * The agent doesn't record executed trades yet, so this renders the framed
 * empty state; wiring is local to this component once a trades source exists.
 * @returns Today's activity card
 */
export function TodaysActivityCard(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-body-sm font-semibold text-fg">Today&apos;s activity</span>
        <span className="font-mono text-caption text-fg-faint">— buys · — sells</span>
      </div>
      <p className="py-8 text-center text-caption text-fg-faint">
        Today&apos;s trades not tracked yet
      </p>
    </Card>
  );
}

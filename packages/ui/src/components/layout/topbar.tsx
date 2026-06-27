import React from "react";

import { Badge } from "../ui/badge";

type TopbarProperties = {
  dryRun: boolean;
  agentStatus: "live" | "error" | "unknown";
};

/**
 * Fixed glassmorphism topbar with Drishti logo and agent status pill.
 * @param props.dryRun - Whether dry-run mode is active
 * @param props.agentStatus - Current agent operational status
 * @returns Topbar element
 */
export function Topbar({ dryRun, agentStatus }: TopbarProperties): React.ReactElement {
  return (
    <header className="topbar">
      <div className="flex flex-1 items-center gap-3">
        <div className="logo-box">दृ</div>
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">Drishti</span>
        <span className="text-[12px] text-text-faint">दृष्टि</span>
      </div>

      <div className="flex items-center gap-2">
        {dryRun && (
          <Badge variant="warning" dot>
            DRY RUN
          </Badge>
        )}
        <Badge
          variant={
            agentStatus === "live" ? "success" : agentStatus === "error" ? "danger" : "default"
          }
          dot
        >
          {agentStatus === "live" ? "LIVE" : agentStatus === "error" ? "ERROR" : "UNKNOWN"}
        </Badge>
      </div>
    </header>
  );
}

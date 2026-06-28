import { useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";

const APP_VERSION = "1.4";

type StatusVariant = "success" | "warning" | "danger";

type TopbarProperties = {
  dryRun: boolean;
  agentStatus: "live" | "error" | "unknown";
  pendingCount: number;
  lastPollAt: string | null;
  onRefresh: () => void;
};

/** Format an ISO timestamp to HH:MM:SS in local time, or "--:--:--" if null. */
function formatPollTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function resolveStatus(
  dryRun: boolean,
  agentStatus: "live" | "error" | "unknown",
): {
  variant: StatusVariant;
  label: string;
} {
  if (agentStatus === "error") return { variant: "danger", label: "ERROR" };
  if (dryRun) return { variant: "warning", label: "DRY RUN" };
  if (agentStatus === "live") return { variant: "success", label: "LIVE" };
  return { variant: "warning", label: "UNKNOWN" };
}

/**
 * Topbar with 3-column layout: wordmark+version | status pill | last-poll + pending + refresh.
 * @param props.dryRun - Whether dry-run mode is active
 * @param props.agentStatus - Current agent operational status
 * @param props.pendingCount - Number of pending buy approvals
 * @param props.lastPollAt - ISO timestamp of the last agent run start
 * @param props.onRefresh - Callback to invalidate all queries
 * @returns Topbar element
 */
export function Topbar({
  dryRun,
  agentStatus,
  pendingCount,
  lastPollAt,
  onRefresh,
}: TopbarProperties): React.ReactElement {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);

  const { variant, label } = resolveStatus(dryRun, agentStatus);

  const handleRefresh = (): void => {
    setSpinning(true);
    onRefresh();
    setTimeout(() => {
      setSpinning(false);
    }, 800);
  };

  return (
    <header className="topbar">
      {/* Left: wordmark + version */}
      <div className="flex min-w-[160px] items-baseline gap-2">
        <span className="text-[16px] font-bold tracking-[-0.02em] text-text-primary">Drishti</span>
        <span className="text-[13px] font-medium text-text-faint">दृष्टि</span>
        <span className="ml-[2px] font-mono text-[10.5px] tracking-[0.04em] text-text-dim">
          v{APP_VERSION}
        </span>
      </div>

      {/* Centre: status pill */}
      <div className={`status-pill status-pill-${variant}`}>
        <span className={`status-dot status-dot-${variant}`} />
        <span className="font-mono text-[12.5px] font-semibold tracking-[0.01em]">{label}</span>
      </div>

      {/* Right: last poll + pending + refresh */}
      <div className="flex min-w-[160px] items-center justify-end gap-3">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[9.5px] uppercase tracking-[0.05em] text-text-dim">Last poll</span>
          <span className="font-mono text-[12px] text-text-tertiary">
            {formatPollTime(lastPollAt)}
          </span>
        </div>

        {pendingCount > 0 && (
          <button
            type="button"
            className="topbar-pending-btn"
            title="Pending approvals"
            onClick={() => {
              void navigate({ to: "/instructions" });
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            {pendingCount} pending
          </button>
        )}

        <button
          type="button"
          className="topbar-refresh-btn"
          title="Refresh data (R)"
          onClick={handleRefresh}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={spinning ? "animate-spin-drk" : ""}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </header>
  );
}

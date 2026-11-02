import type React from "react";

import type { ApprovalSource } from "./approvalSource";

type ApprovalSegmentsProperties = {
  active: ApprovalSource;
  /** Pending agent proposals, shown on the "From Drishti" tab; null until known. */
  drishtiCount: number | null;
  /** Pending buy instructions, shown on the "From you" tab; null until known. */
  youCount: number | null;
  onSelect: (source: ApprovalSource) => void;
};

type Segment = { id: ApprovalSource; label: string; count: number | null; activeClass: string };

/**
 * Segmented control for the Approvals screen (updated design) — splits
 * Drishti's proposals ("From Drishti") from the user's own buy instructions
 * ("From you").
 * @param props.active - Currently selected source
 * @param props.drishtiCount - Pending-proposal count for "From Drishti"
 * @param props.youCount - Pending-instruction count for "From you"
 * @param props.onSelect - Called with the chosen source
 * @returns Segmented control element
 */
export function ApprovalSegments({
  active,
  drishtiCount,
  youCount,
  onSelect,
}: ApprovalSegmentsProperties): React.ReactElement {
  const segments: Segment[] = [
    {
      id: "drishti",
      label: "From Drishti",
      count: drishtiCount,
      activeClass: "bg-warn-tint text-warn",
    },
    { id: "you", label: "From you", count: youCount, activeClass: "bg-info-tint text-info" },
  ];

  return (
    <div
      role="group"
      aria-label="Approval source"
      className="inline-flex gap-1 self-start rounded-xl border border-border-strong bg-surface-2 p-1"
    >
      {segments.map((segment) => {
        const isActive = segment.id === active;
        return (
          <button
            key={segment.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              onSelect(segment.id);
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-body-sm font-medium transition-colors ${
              isActive ? segment.activeClass : "text-fg-muted hover:text-fg"
            }`}
          >
            {segment.label}
            {segment.count !== null && (
              <span className="rounded-pill bg-surface-3 px-1.5 py-0.5 font-mono text-micro">
                {segment.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import type React from "react";

/** Which side of the approvals screen is showing. */
export type ApprovalSource = "drishti" | "you";

type ApprovalSegmentsProperties = {
  active: ApprovalSource;
  /** Count shown on the "From Drishti" tab (pending proposals). */
  drishtiCount: number;
  onSelect: (source: ApprovalSource) => void;
};

type Segment = { id: ApprovalSource; label: string; count?: number };

/**
 * Segmented control for the Approvals screen (updated design) — splits
 * Drishti's proposals ("From Drishti") from the user's own buy-instruction
 * composer ("From you").
 * @param props.active - Currently selected source
 * @param props.drishtiCount - Pending-proposal count badge for "From Drishti"
 * @param props.onSelect - Called with the chosen source
 * @returns Segmented control element
 */
export function ApprovalSegments({
  active,
  drishtiCount,
  onSelect,
}: ApprovalSegmentsProperties): React.ReactElement {
  const segments: Segment[] = [
    { id: "drishti", label: "From Drishti", count: drishtiCount },
    { id: "you", label: "From you" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Approval source"
      className="inline-flex gap-1 self-start rounded-xl border border-border-strong bg-surface-2 p-1"
    >
      {segments.map((segment) => {
        const isActive = segment.id === active;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              onSelect(segment.id);
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-body-sm font-medium transition-colors ${
              isActive ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg"
            }`}
          >
            {segment.label}
            {segment.count !== undefined && segment.count > 0 && (
              <span className="rounded-pill bg-warn-tint px-1.5 py-0.5 font-mono text-micro text-warn">
                {segment.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

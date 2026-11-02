import type React from "react";

type ErrorNoticeProperties = {
  children: React.ReactNode;
  /** Tighter padding for a notice sitting among other content. */
  compact?: boolean;
};

/**
 * Tinted error banner, announced to screen readers as it appears.
 * @param props.children - the message
 * @param props.compact - use the tighter inline padding
 * @returns Error notice element
 */
export function ErrorNotice({
  children,
  compact = false,
}: ErrorNoticeProperties): React.ReactElement {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-neg-ring bg-neg-tint text-body-sm text-neg-soft ${compact ? "px-4 py-3" : "p-4"}`}
    >
      {children}
    </div>
  );
}

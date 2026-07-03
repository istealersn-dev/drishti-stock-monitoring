import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { Spinner } from "../components/ui/spinner";
import { type GttOrder, cancelGttOrder, fetchGttOrders } from "../lib/api";

const TABLE_HEADERS = [
  { label: "Symbol" },
  { label: "Type" },
  { label: "Trigger", right: true },
  { label: "Limit", right: true },
  { label: "Qty", right: true },
  { label: "Status" },
  { label: "Created", right: true },
  { label: "Approval ID" },
  { label: "Action", right: true },
];

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function resolveStatusVariant(status: string): string {
  if (status === "active") return "active";
  if (status === "triggered") return "triggered";
  if (status === "cancelled") return "cancelled";
  if (status === "failed") return "failed";
  return "default";
}

type GttRowProperties = {
  order: GttOrder;
};

function GttRow({ order }: GttRowProperties): React.ReactElement {
  const queryClientInstance = useQueryClient();
  const statusVariant = resolveStatusVariant(order.status);
  const isSlType = order.type.toLowerCase().includes("sl");
  const approvalShort = order.approvalId != null ? order.approvalId.slice(0, 8) : "—";

  const cancelMutation = useMutation({
    mutationFn: cancelGttOrder,
    onSuccess: () => {
      void queryClientInstance.invalidateQueries({ queryKey: ["gtt"] });
    },
  });

  return (
    <div className="gtt-row">
      <span className="font-mono text-[13px] font-semibold text-text-primary">{order.symbol}</span>
      <span>
        <span className={`gtt-type-badge ${isSlType ? "gtt-type-badge-sl" : "gtt-type-badge-buy"}`}>
          {order.type.toUpperCase()}
        </span>
      </span>
      <span className="text-right font-mono text-[12px] text-[#d8d8d8]">
        {formatPrice(order.triggerPrice)}
      </span>
      <span className="text-right font-mono text-[12px] text-text-tertiary">
        {formatPrice(order.limitPrice)}
      </span>
      <span className="text-right font-mono text-[12px] text-[#bcbcbc]">{order.quantity}</span>
      <span>
        <span className={`gtt-status-badge gtt-status-badge-${statusVariant}`}>
          <span className={`gtt-status-dot gtt-status-dot-${statusVariant}`} />
          {order.status}
        </span>
      </span>
      <span className="text-right font-mono text-[11.5px] text-[#8a8a8a]">
        {formatDate(order.createdAt)}
      </span>
      <span className="overflow-hidden text-ellipsis font-mono text-[11px] text-text-dim">
        {approvalShort}
      </span>
      <span className="flex flex-col items-end gap-1 text-right">
        {order.status === "active" && (
          <>
            <button
              type="button"
              className="gtt-cancel-btn"
              onClick={() => {
                cancelMutation.mutate(order.id);
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Spinner size="sm" /> : "Cancel"}
            </button>
            {cancelMutation.isError && (
              <span className="text-[10px] text-danger">
                {cancelMutation.error instanceof Error
                  ? cancelMutation.error.message
                  : "Cancel failed"}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/**
 * GTT Orders page — lists all GTT orders with status badge and cancel action for active ones.
 * @returns Gtt page element
 */
export function Gtt(): React.ReactElement {
  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["gtt"],
    queryFn: () => fetchGttOrders(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load GTT orders.
      </div>
    );
  }

  const active = orders.filter((o) => o.status === "active");
  const rest = orders.filter((o) => o.status !== "active");
  const sorted = [...active, ...rest];

  return (
    <div className="animate-fade-drk">
      <div className="holdings-card overflow-x-auto">
        <div style={{ minWidth: 960 }}>
          {/* Column headers */}
          <div className="gtt-col-grid holdings-col-header">
            {TABLE_HEADERS.map((col) => (
              <span key={col.label} className={col.right === true ? "text-right" : ""}>
                {col.label}
              </span>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[54px] text-center">
              <div className="mb-[14px] flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-border-subtle bg-[#19191b]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5a5a5a"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div className="text-[13.5px] font-medium text-text-tertiary">No active GTTs</div>
              <div className="mx-auto mt-[5px] max-w-[380px] text-[12px] leading-relaxed text-text-dim">
                The agent will create them automatically when SL or target conditions are met.
              </div>
            </div>
          ) : (
            sorted.map((order) => <GttRow key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );
}

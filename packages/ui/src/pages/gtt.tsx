import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { cancelGttOrder, fetchGttOrders, type GttOrder } from "../lib/api";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function statusVariant(status: string): "success" | "danger" | "warning" | "default" | "primary" {
  if (status === "active") return "success";
  if (status === "triggered") return "primary";
  if (status === "cancelled") return "danger";
  return "default";
}

type GttRowProperties = {
  order: GttOrder;
  onCancel: (id: string) => void;
  cancelling: boolean;
  cancelError: string | null;
};

function GttRow({
  order,
  onCancel,
  cancelling,
  cancelError,
}: GttRowProperties): React.ReactElement {
  return (
    <tr className="table-row-data bg-bg-card hover:bg-bg-hover">
      <td className="px-4 font-medium text-text-primary">{order.symbol}</td>
      <td className="px-4">
        <Badge variant={order.type === "sl_exit" ? "danger" : "primary"}>{order.type}</Badge>
      </td>
      <td className="px-4 text-right font-mono">{formatInr(order.triggerPrice)}</td>
      <td className="px-4 text-right font-mono">{formatInr(order.limitPrice)}</td>
      <td className="px-4 text-right font-mono">{order.quantity}</td>
      <td className="px-4">
        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
      </td>
      <td className="px-4 font-mono text-[11px] text-text-muted">
        {new Date(order.createdAt).toLocaleDateString("en-IN")}
      </td>
      <td className="px-4 text-right">
        {order.status === "active" && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="btn-danger py-1 text-[11px]"
              onClick={() => {
                onCancel(order.id);
              }}
              disabled={cancelling}
            >
              {cancelling ? <Spinner size="sm" /> : "Cancel"}
            </button>
            {cancelError && <span className="text-[10px] text-danger-text">{cancelError}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * GTT Orders page — lists all GTT orders with cancel button for active ones.
 * @returns Gtt page element
 */
export function Gtt(): React.ReactElement {
  const queryClientInstance = useQueryClient();
  const [cancelErrors, setCancelErrors] = useState<Partial<Record<string, string>>>({});
  const [cancellingIds, setCancellingIds] = useState<ReadonlySet<string>>(new Set());

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["gtt"],
    queryFn: () => fetchGttOrders(),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGttOrder,
    onSuccess: (_data, id) => {
      setCancellingIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setCancelErrors((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      void queryClientInstance.invalidateQueries({ queryKey: ["gtt"] });
    },
    onError: (error: Error, id: string) => {
      setCancellingIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setCancelErrors((previous) => ({ ...previous, [id]: error.message }));
    },
  });

  const handleCancel = (id: string): void => {
    if (cancellingIds.has(id)) return;
    setCancelErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setCancellingIds((previous) => new Set(previous).add(id));
    cancelMutation.mutate(id);
  };

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

  return (
    <div className="animate-fade-drk space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-text-primary">GTT Orders</h1>
        <Badge variant="success" dot>
          {active.length} active
        </Badge>
      </div>

      {orders.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-card border border-border-default text-text-muted">
          No GTT orders found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-surface">
                <th className="table-row-header px-4">Symbol</th>
                <th className="table-row-header px-4">Type</th>
                <th className="table-row-header px-4 text-right">Trigger</th>
                <th className="table-row-header px-4 text-right">Limit</th>
                <th className="table-row-header px-4 text-right">Qty</th>
                <th className="table-row-header px-4">Status</th>
                <th className="table-row-header px-4">Created</th>
                <th className="table-row-header px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...rest].map((order) => (
                <GttRow
                  key={order.id}
                  order={order}
                  onCancel={handleCancel}
                  cancelling={cancellingIds.has(order.id)}
                  cancelError={cancelErrors[order.id] ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

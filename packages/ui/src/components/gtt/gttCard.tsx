import type React from "react";

import type { GttOrder } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { gttStatusVariant, gttTypeVariant } from "../../lib/gttFormat";
import { formatPrice } from "../../lib/holdingFormat";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

import { GttCancelDialog } from "./gttCancelDialog";
import { useGttCancel } from "./useGttCancel";

type GttCardProperties = {
  order: GttOrder;
};

/**
 * Mobile GTT order card (handoff.md §4 `GttCard.tsx`) — the same fields as
 * `GttTable`'s columns, reflowed into stacked rows. Shares `useGttCancel`
 * with the desktop table so both presentations confirm cancellation
 * identically.
 * @param props.order - the GTT order to render
 * @returns Gtt card element
 */
export function GttCard({ order }: GttCardProperties): React.ReactElement {
  const { confirmOpen, setConfirmOpen, isPending, errorMessage, handleConfirmCancel } =
    useGttCancel(order.id);
  const approvalShort = order.approvalId != null ? order.approvalId.slice(0, 8) : "—";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-body font-semibold uppercase text-fg">
            {order.symbol}
          </span>
          <Badge variant={gttTypeVariant(order.type)}>{order.type.toUpperCase()}</Badge>
        </div>
        <Badge variant={gttStatusVariant(order.status)} dot>
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-caption text-fg-muted">
        <span>
          Trigger <span className="font-mono text-fg-soft">{formatPrice(order.triggerPrice)}</span>
        </span>
        <span>
          Limit <span className="font-mono text-fg-soft">{formatPrice(order.limitPrice)}</span>
        </span>
        <span>
          Qty <span className="font-mono text-fg-soft">{order.quantity}</span>
        </span>
        <span>
          Created <span className="font-mono text-fg-soft">{formatDate(order.createdAt)}</span>
        </span>
      </div>

      <div className="text-caption text-fg-faint">
        Approval <span className="font-mono">{approvalShort}</span>
      </div>

      {order.status === "active" && (
        <GttCancelDialog
          order={order}
          confirmOpen={confirmOpen}
          setConfirmOpen={setConfirmOpen}
          isPending={isPending}
          errorMessage={errorMessage}
          onConfirm={handleConfirmCancel}
        />
      )}
    </Card>
  );
}

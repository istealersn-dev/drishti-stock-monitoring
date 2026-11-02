import { Link } from "@tanstack/react-router";
import type React from "react";

import type { GttOrder } from "../../lib/api";
import { gttStatusVariant, gttTypeLabel, gttTypeVariant } from "../../lib/gttFormat";
import { formatPrice } from "../../lib/holdingFormat";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

// The header links to the full list, so this stays the height of its neighbour.
const VISIBLE_ORDER_LIMIT = 5;

type OpenOrdersCardProperties = {
  orders: GttOrder[];
};

/**
 * Open orders panel (updated design) — the live GTTs at a glance, linking to
 * the full GTT Orders page.
 * @param props.orders - The open GTT orders
 * @returns Open orders card
 */
export function OpenOrdersCard({ orders }: OpenOrdersCardProperties): React.ReactElement {
  const newestFirst = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Card className="flex flex-col gap-0 overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-body-sm font-semibold text-fg">Open orders</span>
        <Link
          to="/gtt"
          className="font-mono text-caption text-gold transition-colors hover:text-gold-bright"
        >
          {orders.length} active ›
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-caption text-fg-faint">No open orders</p>
      ) : (
        <ul>
          {newestFirst.slice(0, VISIBLE_ORDER_LIMIT).map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-body-sm uppercase text-fg">
                    {order.symbol}
                  </span>
                  <Badge variant={gttTypeVariant(order.type)}>{gttTypeLabel(order.type)}</Badge>
                </div>
                <div className="mt-0.5 font-mono text-caption text-fg-dim">
                  trigger ₹{formatPrice(order.triggerPrice)} · qty {order.quantity}
                </div>
              </div>
              <Badge variant={gttStatusVariant(order.status)} dot>
                {order.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

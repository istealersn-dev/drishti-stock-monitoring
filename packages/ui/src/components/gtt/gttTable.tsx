import type React from "react";

import type { GttOrder } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { gttStatusVariant, gttTypeVariant } from "../../lib/gttFormat";
import { formatPrice } from "../../lib/holdingFormat";
import { Badge } from "../ui/badge";
import { Table } from "../ui/table";

import { GttCancelDialog } from "./gttCancelDialog";

type GttRowProperties = {
  order: GttOrder;
};

function GttRow({ order }: GttRowProperties): React.ReactElement {
  const approvalShort = order.approvalId != null ? order.approvalId.slice(0, 8) : "—";

  return (
    <Table.Row>
      <Table.Cell className="font-mono uppercase">{order.symbol}</Table.Cell>
      <Table.Cell>
        <Badge variant={gttTypeVariant(order.type)}>{order.type.toUpperCase()}</Badge>
      </Table.Cell>
      <Table.Cell numeric>{formatPrice(order.triggerPrice)}</Table.Cell>
      <Table.Cell numeric>{formatPrice(order.limitPrice)}</Table.Cell>
      <Table.Cell numeric>{order.quantity}</Table.Cell>
      <Table.Cell>
        <Badge variant={gttStatusVariant(order.status)} dot>
          {order.status}
        </Badge>
      </Table.Cell>
      <Table.Cell numeric>{formatDate(order.createdAt)}</Table.Cell>
      <Table.Cell className="font-mono text-caption text-fg-faint">{approvalShort}</Table.Cell>
      <Table.Cell align="right">
        {order.status === "active" && <GttCancelDialog order={order} />}
      </Table.Cell>
    </Table.Row>
  );
}

type GttTableProperties = {
  orders: GttOrder[];
};

/**
 * Desktop GTT orders table (handoff.md §4 `GttTable.tsx`) — 9 columns with a
 * Radix Dialog confirm before cancelling an active order (handoff.md §5:
 * destructive mutations go through a Radix Dialog confirm). Shares
 * `GttCancelDialog` with `GttCard`'s mobile presentation.
 * @param props.orders - the GTT orders to render, active-first
 * @returns Gtt table element
 */
export function GttTable({ orders }: GttTableProperties): React.ReactElement {
  return (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Symbol</Table.HeaderCell>
          <Table.HeaderCell>Type</Table.HeaderCell>
          <Table.HeaderCell align="right">Trigger</Table.HeaderCell>
          <Table.HeaderCell align="right">Limit</Table.HeaderCell>
          <Table.HeaderCell align="right">Qty</Table.HeaderCell>
          <Table.HeaderCell>Status</Table.HeaderCell>
          <Table.HeaderCell align="right">Created</Table.HeaderCell>
          <Table.HeaderCell>Approval ID</Table.HeaderCell>
          <Table.HeaderCell align="right">Action</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {orders.map((order) => (
          <GttRow key={order.id} order={order} />
        ))}
      </Table.Body>
    </Table>
  );
}

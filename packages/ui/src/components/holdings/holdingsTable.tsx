import type React from "react";

import type { Holding } from "../../lib/api";
import {
  formatPnl,
  formatPrice,
  ltpDirectionArrow,
  productBadgeVariant,
} from "../../lib/holdingFormat";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table } from "../ui/table";

import { useHoldingGttForm } from "./useHoldingGttForm";

type HoldingRowProperties = {
  holding: Holding;
};

function HoldingRow({ holding }: HoldingRowProperties): React.ReactElement {
  const { sl, setSl, target, setTarget, saveError, isPending, handleSetGtt } = useHoldingGttForm(
    holding.trading_symbol,
  );
  const ltpColor = holding.last_price >= holding.close_price ? "text-pos" : "text-neg";
  const pnlColor = holding.pnl >= 0 ? "text-pos" : "text-neg";
  const cost = holding.quantity * holding.average_price;

  return (
    <Table.Row>
      <Table.Cell className="font-mono uppercase">{holding.trading_symbol}</Table.Cell>
      <Table.Cell>
        <Badge>{holding.exchange}</Badge>
      </Table.Cell>
      <Table.Cell>
        <Badge variant={productBadgeVariant(holding.product)}>{holding.product}</Badge>
      </Table.Cell>
      <Table.Cell numeric>{holding.quantity}</Table.Cell>
      <Table.Cell numeric>{formatPrice(holding.average_price)}</Table.Cell>
      <Table.Cell numeric className={ltpColor}>
        <span aria-hidden="true">{ltpDirectionArrow(holding.last_price, holding.close_price)}</span>{" "}
        {formatPrice(holding.last_price)}
      </Table.Cell>
      <Table.Cell numeric className={pnlColor}>
        {formatPnl(holding.pnl, cost)}
      </Table.Cell>
      <Table.Cell align="right">
        <input
          type="text"
          inputMode="decimal"
          value={sl}
          placeholder="—"
          onChange={(event) => {
            setSl(event.target.value);
          }}
          disabled={isPending}
          aria-label={`Stop-loss threshold for ${holding.trading_symbol}`}
          className="h-8 w-20 rounded-md border border-neg-ring bg-neg-tint px-2 text-right font-mono text-body-sm text-fg outline-none focus-visible:border-border-focus disabled:cursor-not-allowed disabled:opacity-50"
        />
      </Table.Cell>
      <Table.Cell align="right">
        <input
          type="text"
          inputMode="decimal"
          value={target}
          placeholder="—"
          onChange={(event) => {
            setTarget(event.target.value);
          }}
          disabled={isPending}
          aria-label={`Target price for ${holding.trading_symbol}`}
          className="h-8 w-20 rounded-md border border-pos-ring bg-pos-tint px-2 text-right font-mono text-body-sm text-fg outline-none focus-visible:border-border-focus disabled:cursor-not-allowed disabled:opacity-50"
        />
      </Table.Cell>
      <Table.Cell align="right">
        <div className="flex flex-col items-end gap-1">
          <Button variant="secondary" onClick={handleSetGtt} disabled={isPending}>
            {isPending ? "Saving…" : "Set GTT"}
          </Button>
          {saveError !== null && <span className="text-caption text-neg">{saveError}</span>}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

type HoldingsTableProperties = {
  holdings: Holding[];
};

/**
 * Desktop holdings table (handoff.md §4 `HoldingsTable.tsx`) — 10 columns
 * with inline SL/target inputs and a per-row "Set GTT" action. Shares
 * `useHoldingGttForm` with `HoldingCard`'s mobile presentation.
 * @param props.holdings - the filtered holdings to render
 * @returns Holdings table element
 */
export function HoldingsTable({ holdings }: HoldingsTableProperties): React.ReactElement {
  return (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Symbol</Table.HeaderCell>
          <Table.HeaderCell>Exch</Table.HeaderCell>
          <Table.HeaderCell>Product</Table.HeaderCell>
          <Table.HeaderCell align="right">Qty</Table.HeaderCell>
          <Table.HeaderCell align="right">Avg buy</Table.HeaderCell>
          <Table.HeaderCell align="right">LTP</Table.HeaderCell>
          <Table.HeaderCell align="right">Unreal. P&amp;L</Table.HeaderCell>
          <Table.HeaderCell align="right">SL thresh.</Table.HeaderCell>
          <Table.HeaderCell align="right">Target</Table.HeaderCell>
          <Table.HeaderCell align="right">Actions</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {holdings.map((holding) => (
          <HoldingRow key={`${holding.isin}-${holding.product}`} holding={holding} />
        ))}
      </Table.Body>
    </Table>
  );
}

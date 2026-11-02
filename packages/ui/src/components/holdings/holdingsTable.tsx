import type React from "react";

import type { Holding } from "../../lib/api";
import { formatPriceOrDash } from "../../lib/format";
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
  currentSl: number | undefined;
  currentTarget: number | undefined;
};

function HoldingRow({
  holding,
  currentSl,
  currentTarget,
}: HoldingRowProperties): React.ReactElement {
  const { sl, setSl, target, setTarget, saveError, isPending, handleSaveThreshold } =
    useHoldingGttForm(holding.trading_symbol);
  const errorId = `${holding.trading_symbol}-${holding.product}-save-error`;
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
          placeholder={formatPriceOrDash(currentSl ?? null)}
          aria-invalid={saveError !== null}
          aria-describedby={saveError !== null ? errorId : undefined}
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
          placeholder={formatPriceOrDash(currentTarget ?? null)}
          aria-invalid={saveError !== null}
          aria-describedby={saveError !== null ? errorId : undefined}
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
          <Button
            variant="secondary"
            onClick={handleSaveThreshold}
            disabled={isPending}
            title="Places an exit GTT automatically if price breaches this SL — no order is placed now."
          >
            {isPending ? "Saving…" : "Save SL"}
          </Button>
          {saveError !== null && (
            <span id={errorId} role="alert" className="text-caption text-neg">
              {saveError}
            </span>
          )}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

type HoldingsTableProperties = {
  holdings: Holding[];
  slMap: Map<string, number>;
  targetMap: Map<string, number>;
};

/**
 * Desktop holdings table (handoff.md §4 `HoldingsTable.tsx`) — 10 columns
 * with inline SL/target inputs and a per-row "Save SL" action. Shares
 * `useHoldingGttForm` with `HoldingCard`'s mobile presentation.
 * @param props.holdings - the filtered holdings to render
 * @param props.slMap - Symbol -> current stop-loss, shown as each SL input's hint
 * @param props.targetMap - Symbol -> current target, shown as each target input's hint
 * @returns Holdings table element
 */
export function HoldingsTable({
  holdings,
  slMap,
  targetMap,
}: HoldingsTableProperties): React.ReactElement {
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
          <HoldingRow
            key={`${holding.isin}-${holding.product}`}
            holding={holding}
            currentSl={slMap.get(holding.trading_symbol)}
            currentTarget={targetMap.get(holding.trading_symbol)}
          />
        ))}
      </Table.Body>
    </Table>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { StatCard } from "../components/dashboard/statCard";
import { PageHeader } from "../components/shell/pageHeader";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { Table } from "../components/ui/table";
import {
  type ProximityAlert,
  type WatchlistEntry,
  addWatchlistEntry,
  fetchWatchlist,
  removeWatchlistEntry,
} from "../lib/api";

type ProximityCardProperties = {
  alert: ProximityAlert;
};

function ProximityCard({ alert }: ProximityCardProperties): React.ReactElement {
  return (
    <StatCard
      label={alert.displayName}
      accent="warn"
      value={
        <>
          <span className="text-warn">{alert.distancePct.toFixed(1)}%</span>
          <span className="text-body-sm font-medium text-fg-muted"> to 200-DMA</span>
        </>
      }
      sub={`LTP ${alert.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · DMA ${alert.dma200.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
    />
  );
}

type EntryRowProperties = {
  entry: WatchlistEntry;
  onRemove: (symbol: string) => void;
  removing: boolean;
};

function EntryRow({ entry, onRemove, removing }: EntryRowProperties): React.ReactElement {
  return (
    <Table.Row>
      <Table.Cell className="font-mono uppercase">{entry.symbol}</Table.Cell>
      <Table.Cell className="max-w-xs truncate">{entry.notes ?? "—"}</Table.Cell>
      <Table.Cell>{new Date(entry.addedAt).toLocaleDateString("en-IN")}</Table.Cell>
      <Table.Cell align="right">
        <Button
          variant="destructive"
          disabled={removing}
          onClick={() => {
            onRemove(entry.symbol);
          }}
        >
          {removing ? "Removing…" : "Remove"}
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * Watchlist page (Phase 7) — add form, 200-DMA proximity alerts, and a
 * removable watchlist table.
 * @returns Watchlist page element
 */
export function Watchlist(): React.ReactElement {
  const [symbol, setSymbol] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["watchlist"],
    queryFn: fetchWatchlist,
  });

  const addMutation = useMutation({
    mutationFn: addWatchlistEntry,
    onSuccess: () => {
      setSymbol("");
      setDisplayName("");
      setNotes("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeWatchlistEntry,
    onSuccess: (_data, symbolArgument) => {
      setPendingRemovals((previous) => {
        const next = new Set(previous);
        next.delete(symbolArgument);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (_error, symbolArgument) => {
      setPendingRemovals((previous) => {
        const next = new Set(previous);
        next.delete(symbolArgument);
        return next;
      });
    },
  });

  const handleAdd = (): void => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedName = displayName.trim();
    if (!trimmedSymbol || !trimmedName) {
      setFormError("Symbol and display name are required");
      return;
    }
    addMutation.mutate({
      symbol: trimmedSymbol,
      displayName: trimmedName,
      notes: notes.trim() || null,
    });
  };

  const handleRemove = (symbolArgument: string): void => {
    if (pendingRemovals.has(symbolArgument)) return;
    setPendingRemovals((previous) => new Set(previous).add(symbolArgument));
    removeMutation.mutate(symbolArgument);
  };

  const entries = data?.entries ?? [];
  const proximityAlerts = data?.proximityAlerts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Watchlist"
        subtitle="Track stocks approaching a good entry near their 200-DMA."
      />
      <Card className="flex flex-col gap-3">
        <h2 className="text-body-sm font-semibold text-fg">Add to watchlist</h2>
        <form
          className="flex flex-wrap items-end gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
        >
          <div className="w-44">
            <Input
              id="watchlist-symbol"
              label="Symbol"
              value={symbol}
              onChange={(value) => {
                setSymbol(value);
                setFormError(null);
              }}
              placeholder="e.g. TATAMOTORS"
              autoComplete="off"
            />
          </div>
          <div className="w-52">
            <Input
              id="watchlist-display-name"
              label="Display name"
              value={displayName}
              onChange={(value) => {
                setDisplayName(value);
                setFormError(null);
              }}
              placeholder="Display name"
              autoComplete="off"
            />
          </div>
          <div className="min-w-52 flex-1">
            <Input
              id="watchlist-notes"
              label="Notes"
              value={notes}
              onChange={setNotes}
              placeholder="Notes (optional)"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!symbol.trim() || !displayName.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
        {formError !== null && <p className="text-caption text-neg">{formError}</p>}
      </Card>

      {proximityAlerts.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-title font-semibold text-fg">Near 200-DMA</h2>
          <div className="grid grid-cols-2 gap-3.5 nav:grid-cols-3">
            {proximityAlerts.map((alert) => (
              <ProximityCard key={alert.symbol} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
          Failed to load watchlist. Is the agent running?
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
          <p className="text-body-sm font-medium text-fg-muted">Watchlist is empty</p>
          <p className="text-caption text-fg-faint">Add a stock above to start tracking it.</p>
        </div>
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Symbol</Table.HeaderCell>
              <Table.HeaderCell>Notes</Table.HeaderCell>
              <Table.HeaderCell>Added</Table.HeaderCell>
              <Table.HeaderCell align="right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {entries.map((entry) => (
              <EntryRow
                key={entry.symbol}
                entry={entry}
                onRemove={handleRemove}
                removing={pendingRemovals.has(entry.symbol)}
              />
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

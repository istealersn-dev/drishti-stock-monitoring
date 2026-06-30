import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Spinner } from "../components/ui/spinner";
import {
  type ProximityAlert,
  type WatchlistEntry,
  addWatchlistEntry,
  fetchWatchlist,
  removeWatchlistEntry,
} from "../lib/api";

const ENTRY_GRID = "grid grid-cols-[120px_minmax(0,1fr)_140px_80px] items-center px-4";
const ENTRY_HEADERS = [
  { label: "Symbol" },
  { label: "Notes" },
  { label: "Added" },
  { label: "Actions", right: true },
];

type ProximityCardProperties = {
  alert: ProximityAlert;
};

function ProximityCard({ alert }: ProximityCardProperties): React.ReactElement {
  return (
    <div className="stat-card">
      <div className="stat-card-accent stat-card-accent-warning" />
      <div className="stat-card-label">{alert.displayName}</div>
      <div className="stat-card-value">
        <span className="text-warning">{alert.distancePct.toFixed(1)}%</span>
        <span className="text-[13px] font-medium text-[#8a6d2f]"> to 200-DMA</span>
      </div>
      <div className="stat-card-sub font-mono">
        LTP {alert.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · DMA{" "}
        {alert.dma200.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

type EntryRowProperties = {
  entry: WatchlistEntry;
  onRemove: (symbol: string) => void;
  removing: boolean;
};

function EntryRow({ entry, onRemove, removing }: EntryRowProperties): React.ReactElement {
  return (
    <div className={`${ENTRY_GRID} holdings-data-row`}>
      <span className="font-mono text-[13px] font-semibold text-text-primary">{entry.symbol}</span>
      <span className="truncate text-[12px] text-text-tertiary">{entry.notes ?? "—"}</span>
      <span className="font-mono text-[11.5px] text-text-dim">
        {new Date(entry.addedAt).toLocaleDateString("en-IN")}
      </span>
      <span className="flex justify-end">
        <button
          type="button"
          className="gtt-cancel-btn"
          disabled={removing}
          onClick={() => {
            onRemove(entry.symbol);
          }}
        >
          {removing ? <Spinner size="sm" /> : "Remove"}
        </button>
      </span>
    </div>
  );
}

/**
 * Watchlist page — add form, 200-DMA proximity alerts, and a removable watchlist table.
 * @returns Watchlist page element
 */
export function Watchlist(): React.ReactElement {
  const [symbol, setSymbol] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<string>>(new Set());
  const queryClientInstance = useQueryClient();

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
      void queryClientInstance.invalidateQueries({ queryKey: ["watchlist"] });
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
      void queryClientInstance.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (_error, symbolArgument) => {
      setPendingRemovals((previous) => {
        const next = new Set(previous);
        next.delete(symbolArgument);
        return next;
      });
    },
  });

  const handleAdd = (event: React.FormEvent): void => {
    event.preventDefault();
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
    <div className="animate-fade-drk max-w-[940px] space-y-4">
      {/* Add form */}
      <div className="settings-card">
        <div className="mb-3 text-[13px] font-semibold text-text-primary">Add to watchlist</div>
        <form onSubmit={handleAdd} className="flex flex-wrap items-stretch gap-[10px]">
          <input
            type="text"
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value);
              setFormError(null);
            }}
            placeholder="Symbol (e.g. TATAMOTORS)"
            className="instr-input flex-none basis-[200px]"
            autoComplete="off"
          />
          <input
            type="text"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFormError(null);
            }}
            placeholder="Display name"
            className="instr-input flex-none basis-[200px]"
            autoComplete="off"
          />
          <input
            type="text"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            placeholder="Notes (optional)"
            className="instr-input flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            className="instr-send-btn"
            disabled={!symbol.trim() || !displayName.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? <Spinner size="sm" /> : "Add"}
          </button>
        </form>
        {formError != null && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
            {formError}
          </div>
        )}
      </div>

      {/* Proximity alerts */}
      {proximityAlerts.length > 0 && (
        <div className="space-y-[10px]">
          <span className="text-[13px] font-semibold text-text-primary">Near 200-DMA</span>
          <div className="grid grid-cols-3 gap-[14px]">
            {proximityAlerts.map((alert) => (
              <ProximityCard key={alert.symbol} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Watchlist table */}
      {isError ? (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-[12px] text-danger-text">
          Failed to load watchlist. Is the agent running?
        </div>
      ) : isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="holdings-card overflow-x-auto">
          <div style={{ minWidth: 560 }}>
            <div className={`${ENTRY_GRID} holdings-col-header`}>
              {ENTRY_HEADERS.map((col) => (
                <span key={col.label} className={col.right === true ? "text-right" : ""}>
                  {col.label}
                </span>
              ))}
            </div>
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-10">
                <p className="text-[13.5px] font-medium text-text-tertiary">Watchlist is empty</p>
                <p className="text-[12px] text-text-dim">Add a stock above to start tracking it.</p>
              </div>
            ) : (
              entries.map((entry) => (
                <EntryRow
                  key={entry.symbol}
                  entry={entry}
                  onRemove={handleRemove}
                  removing={pendingRemovals.has(entry.symbol)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

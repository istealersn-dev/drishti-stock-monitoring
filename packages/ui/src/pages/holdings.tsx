import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { fetchHoldings, updateHoldingConfig, type Holding } from "../lib/api";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function pnlVariant(value: number): "success" | "danger" | "default" {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "default";
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() && !Number.isNaN(n) && n > 0 ? n : null;
}

type ConfigEditorProperties = {
  symbol: string;
  onDone: () => void;
};

function ConfigEditor({ symbol, onDone }: ConfigEditorProperties): React.ReactElement {
  const queryClientInstance = useQueryClient();
  const [slThreshold, setSlThreshold] = useState("");
  const [targetOne, setTargetOne] = useState("");
  const [targetTwo, setTargetTwo] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const mutation = useMutation({
    mutationFn: (patch: {
      slThreshold: number;
      targetOne: number | null;
      targetTwo: number | null;
    }) => updateHoldingConfig(symbol, patch),
    onSuccess: () => {
      void queryClientInstance.invalidateQueries({ queryKey: ["gtt"] });
      setSavedOk(true);
      setTimeout(onDone, 800);
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  const handleSave = (event: React.FormEvent): void => {
    event.preventDefault();
    setLocalError(null);
    setSavedOk(false);

    const sl = parsePositiveNumber(slThreshold);
    if (sl === null) {
      setLocalError("SL must be a positive number");
      return;
    }

    const t1 = targetOne.trim() ? parsePositiveNumber(targetOne) : null;
    if (targetOne.trim() && t1 === null) {
      setLocalError("T1 must be a positive number");
      return;
    }

    const t2 = targetTwo.trim() ? parsePositiveNumber(targetTwo) : null;
    if (targetTwo.trim() && t2 === null) {
      setLocalError("T2 must be a positive number");
      return;
    }

    if (t2 !== null && t1 === null) {
      setLocalError("T1 is required when T2 is set");
      return;
    }

    if (t1 !== null && t2 !== null && t1 >= t2) {
      setLocalError("T1 must be less than T2");
      return;
    }

    mutation.mutate({ slThreshold: sl, targetOne: t1, targetTwo: t2 });
  };

  return (
    <form
      onSubmit={handleSave}
      className="mt-2 rounded-lg border border-border-dim bg-bg-inset p-3 text-[12px]"
    >
      <p className="mb-2 text-[11px] text-text-dim">
        Leave T1/T2 blank to clear. Changes take effect on next agent poll.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">SL *</span>
          <input
            type="number"
            step="0.01"
            value={slThreshold}
            onChange={(e) => {
              setSlThreshold(e.target.value);
            }}
            placeholder="e.g. 520"
            className="rounded border border-border-default bg-bg-surface px-2 py-1 font-mono text-text-primary focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">T1</span>
          <input
            type="number"
            step="0.01"
            value={targetOne}
            onChange={(e) => {
              setTargetOne(e.target.value);
            }}
            placeholder="optional"
            className="rounded border border-border-default bg-bg-surface px-2 py-1 font-mono text-text-primary focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">T2</span>
          <input
            type="number"
            step="0.01"
            value={targetTwo}
            onChange={(e) => {
              setTargetTwo(e.target.value);
            }}
            placeholder="optional"
            className="rounded border border-border-default bg-bg-surface px-2 py-1 font-mono text-text-primary focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      {localError && <p className="mt-2 text-[11px] text-danger-text">{localError}</p>}
      {savedOk && (
        <p className="mt-2 text-[11px] text-success-text">Saved — active on next agent poll.</p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          className="btn-primary py-1 text-[11px]"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Spinner size="sm" /> : "Save"}
        </button>
        <button
          type="button"
          className="btn-ghost py-1 text-[11px]"
          onClick={onDone}
          disabled={mutation.isPending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type HoldingRowProperties = {
  holding: Holding;
};

function HoldingRow({ holding: h }: HoldingRowProperties): React.ReactElement {
  const [editing, setEditing] = useState(false);

  return (
    <React.Fragment>
      <tr className="table-row-data bg-bg-card hover:bg-bg-hover">
        <td className="px-4">
          <p className="font-medium text-text-primary">{h.trading_symbol}</p>
          <p className="text-[11px] text-text-muted">{h.company_name}</p>
        </td>
        <td className="px-4 text-right font-mono">{h.quantity}</td>
        <td className="px-4 text-right font-mono">{formatInr(h.average_price)}</td>
        <td className="px-4 text-right font-mono font-medium text-text-primary">
          {formatInr(h.last_price)}
        </td>
        <td
          className={`px-4 text-right font-mono ${h.day_change_percentage >= 0 ? "text-success" : "text-danger"}`}
        >
          {formatPct(h.day_change_percentage)}
        </td>
        <td className="px-4 text-right">
          <Badge variant={pnlVariant(h.pnl)}>{formatInr(h.pnl)}</Badge>
        </td>
        <td className="px-4">
          <Badge variant={h.product === "MTF" ? "warning" : "default"}>{h.product}</Badge>
        </td>
        <td className="px-4">
          <span className="text-[12px] text-text-muted">{h.exchange}</span>
        </td>
        <td className="px-4 text-right">
          <button
            type="button"
            className="btn-ghost py-1 text-[11px]"
            onClick={() => {
              setEditing((previous) => !previous);
            }}
          >
            {editing ? "Close" : "Edit SL"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="bg-bg-inset">
          <td colSpan={9} className="px-4 pb-3 pt-1">
            <ConfigEditor
              symbol={h.trading_symbol}
              onDone={() => {
                setEditing(false);
              }}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

/**
 * Holdings page — full holdings table with live prices, P&L, and inline SL/target config.
 * @returns Holdings page element
 */
export function Holdings(): React.ReactElement {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  const holdings = data?.holdings ?? [];

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
        Failed to load holdings. Is the agent running?
      </div>
    );
  }

  return (
    <div className="animate-fade-drk space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-text-primary">Holdings</h1>
        {data?.cachedAt && (
          <span className="text-[11px] text-text-faint">
            Cached {new Date(data.cachedAt).toLocaleTimeString("en-IN")}
          </span>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-card border border-border-default text-text-muted">
          No holdings found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-surface">
                <th className="table-row-header px-4">Symbol</th>
                <th className="table-row-header px-4 text-right">Qty</th>
                <th className="table-row-header px-4 text-right">Avg</th>
                <th className="table-row-header px-4 text-right">LTP</th>
                <th className="table-row-header px-4 text-right">Day</th>
                <th className="table-row-header px-4 text-right">P&L</th>
                <th className="table-row-header px-4">Product</th>
                <th className="table-row-header px-4">Exchange</th>
                <th className="table-row-header px-4 text-right">Config</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h: Holding) => (
                <HoldingRow key={h.isin} holding={h} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

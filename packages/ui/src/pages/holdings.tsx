import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Spinner } from "../components/ui/spinner";
import { type Holding, fetchHoldings, updateHoldingConfig } from "../lib/api";

type ProductFilter = "ALL" | "CNC" | "MTF" | "NSE" | "BSE";

const FILTER_TABS: ProductFilter[] = ["ALL", "CNC", "MTF", "NSE", "BSE"];

const TABLE_HEADERS = [
  { label: "Symbol" },
  { label: "Exch" },
  { label: "Product" },
  { label: "Qty", right: true },
  { label: "Avg buy", right: true },
  { label: "LTP", right: true },
  { label: "Unreal. P&L", right: true },
  { label: "SL thresh.", right: true },
  { label: "Target", right: true },
  { label: "Actions", right: true },
];

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPnl(pnl: number, cost: number): string {
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  const sign = pnl >= 0 ? "+" : "−";
  const absString = Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${sign}₹${absString} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
}

function productBadgeClass(product: string): string {
  if (product === "MTF") return "product-badge product-badge-mtf";
  if (product === "CNC") return "product-badge product-badge-cnc";
  return "product-badge product-badge-default";
}

type HoldingRowProperties = {
  holding: Holding;
};

function HoldingRow({ holding: h }: HoldingRowProperties): React.ReactElement {
  const [sl, setSl] = useState("");
  const [target, setTarget] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClientInstance = useQueryClient();

  const mutation = useMutation({
    mutationFn: (patch: {
      slThreshold: number;
      targetOne: number | null;
      targetTwo: number | null;
    }) => updateHoldingConfig(h.trading_symbol, patch),
    onSuccess: () => {
      void queryClientInstance.invalidateQueries({ queryKey: ["gtt"] });
      setSaveError(null);
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const handleSetGtt = (): void => {
    const slNumber = Number(sl);
    const tgtNumber = Number(target);
    if (!sl.trim() || Number.isNaN(slNumber) || slNumber <= 0) {
      setSaveError("Enter a valid SL before setting GTT");
      return;
    }
    mutation.mutate({
      slThreshold: slNumber,
      targetOne: target.trim() && !Number.isNaN(tgtNumber) && tgtNumber > 0 ? tgtNumber : null,
      targetTwo: null,
    });
  };

  const ltpColor = h.last_price >= h.close_price ? "text-success" : "text-danger";
  const pnlColor = h.pnl >= 0 ? "text-success" : "text-danger";
  const directionArrow = h.last_price >= h.close_price ? "▲" : "▼";
  const cost = h.quantity * h.average_price;

  return (
    <div className="hp-row group">
      <span className="font-mono text-[13px] font-semibold text-text-primary">
        {h.trading_symbol}
      </span>
      <span>
        <span className="exchange-badge">{h.exchange}</span>
      </span>
      <span>
        <span className={productBadgeClass(h.product)}>{h.product}</span>
      </span>
      <span className="text-right font-mono text-[12px] text-[#bcbcbc]">{h.quantity}</span>
      <span className="text-right font-mono text-[12px] text-[#bcbcbc]">
        {formatPrice(h.average_price)}
      </span>
      <span className={`text-right font-mono text-[12px] ${ltpColor}`}>
        {directionArrow} {formatPrice(h.last_price)}
      </span>
      <span className={`text-right font-mono text-[12px] ${pnlColor}`}>
        {formatPnl(h.pnl, cost)}
        {saveError !== null && <span className="block text-[10px] text-danger">{saveError}</span>}
      </span>
      <span className="flex justify-end">
        <input
          type="text"
          inputMode="decimal"
          value={sl}
          placeholder="—"
          onChange={(event) => {
            setSl(event.target.value);
          }}
          className="hp-sl-input"
          disabled={mutation.isPending}
        />
      </span>
      <span className="flex justify-end">
        <input
          type="text"
          inputMode="decimal"
          value={target}
          placeholder="—"
          onChange={(event) => {
            setTarget(event.target.value);
          }}
          className="hp-target-input"
          disabled={mutation.isPending}
        />
      </span>
      <span className="flex items-center justify-end gap-[6px]">
        {mutation.isPending ? (
          <Spinner size="sm" />
        ) : (
          <button type="button" className="hp-set-gtt-btn" onClick={handleSetGtt}>
            Set GTT
          </button>
        )}
      </span>
    </div>
  );
}

function applyFilter(holdings: Holding[], filter: ProductFilter, search: string): Holding[] {
  let result = holdings;
  if (filter !== "ALL") {
    if (filter === "NSE" || filter === "BSE") {
      result = result.filter((h) => h.exchange === filter);
    } else {
      result = result.filter((h) => h.product === filter);
    }
  }
  if (search.trim()) {
    const lower = search.toLowerCase();
    result = result.filter(
      (h) =>
        h.trading_symbol.toLowerCase().includes(lower) ||
        h.company_name.toLowerCase().includes(lower),
    );
  }
  return result;
}

/**
 * Holdings page — filterable table with inline SL/target inputs and Set GTT action.
 * @returns Holdings page element
 */
export function Holdings(): React.ReactElement {
  const [filter, setFilter] = useState<ProductFilter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  const holdings = data?.holdings ?? [];
  const visible = applyFilter(holdings, filter, search);

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
    <div className="animate-fade-drk space-y-[14px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-[14px]">
        <div className="hp-search-wrap">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6a6a6a"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            placeholder="Search symbol or name…"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            className="hp-search-input"
          />
        </div>

        <div className="filter-tabs max-w-full overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`filter-tab ${filter === tab ? "filter-tab-active" : ""}`}
              onClick={() => {
                setFilter(tab);
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="holdings-card overflow-x-auto">
        <div style={{ minWidth: 1020 }}>
          {/* Column headers */}
          <div className="hp-col-grid holdings-col-header">
            {TABLE_HEADERS.map((col) => (
              <span key={col.label} className={col.right === true ? "text-right" : ""}>
                {col.label}
              </span>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10">
              <p className="text-[13.5px] font-medium text-text-tertiary">No positions</p>
              <p className="text-[12px] text-text-dim">
                {search ? "Try a different search." : "Holdings appear once data is synced."}
              </p>
            </div>
          ) : (
            visible.map((holding) => (
              <HoldingRow key={`${holding.isin}-${holding.product}`} holding={holding} />
            ))
          )}
        </div>
      </div>

      {data?.cachedAt != null && (
        <p className="text-[11px] text-text-faint">
          Prices cached at {new Date(data.cachedAt).toLocaleTimeString("en-IN")}
        </p>
      )}
    </div>
  );
}

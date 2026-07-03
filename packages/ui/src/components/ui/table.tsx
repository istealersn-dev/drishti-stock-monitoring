import type React from "react";

type TableRootProperties = {
  children: React.ReactNode;
  className?: string;
};

function TableRoot({ children, className = "" }: TableRootProperties): React.ReactElement {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-body-sm ${className}`}>{children}</table>
    </div>
  );
}

type TableHeadProperties = {
  children: React.ReactNode;
};

function TableHead({ children }: TableHeadProperties): React.ReactElement {
  return <thead>{children}</thead>;
}

type TableBodyProperties = {
  children: React.ReactNode;
};

function TableBody({ children }: TableBodyProperties): React.ReactElement {
  return <tbody>{children}</tbody>;
}

type TableRowProperties = {
  children: React.ReactNode;
  className?: string;
};

function TableRow({ children, className = "" }: TableRowProperties): React.ReactElement {
  return (
    <tr
      className={`border-b border-border transition-colors last:border-0 hover:bg-surface-hover ${className}`}
    >
      {children}
    </tr>
  );
}

type Alignment = "left" | "right" | "center";

const ALIGN_CLASS: Record<Alignment, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

type TableHeaderCellProperties = {
  children: React.ReactNode;
  align?: Alignment;
  className?: string;
};

function TableHeaderCell({
  children,
  align = "left",
  className = "",
}: TableHeaderCellProperties): React.ReactElement {
  return (
    <th
      scope="col"
      className={`h-9 px-3 font-mono text-caption font-semibold uppercase tracking-wider text-fg-muted ${ALIGN_CLASS[align]} ${className}`}
    >
      {children}
    </th>
  );
}

type TableCellProperties = {
  children: React.ReactNode;
  align?: Alignment;
  numeric?: boolean;
  className?: string;
};

function TableCell({
  children,
  align = "left",
  numeric = false,
  className = "",
}: TableCellProperties): React.ReactElement {
  return (
    <td
      className={`h-11 px-3 text-fg ${ALIGN_CLASS[align]} ${numeric ? "font-mono tabular-nums" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * Semantic data table (Design.md §6) — Holdings/GTT desktop tables, wrapped
 * in a horizontal-scroll container (mission constraint: horizontal-scroll
 * wrapper, not a mobile-duplicate tree — mobile uses a separate card list
 * built from the same row view-model, per handoff.md §4).
 * Compound component: `Table.Head`, `Table.Body`, `Table.Row`,
 * `Table.HeaderCell`, `Table.Cell`.
 * @returns Table root wrapping a scrollable `<table>`
 */
export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  HeaderCell: TableHeaderCell,
  Cell: TableCell,
});

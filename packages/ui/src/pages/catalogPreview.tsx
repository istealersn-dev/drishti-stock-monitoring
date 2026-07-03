import type React from "react";
import { useState } from "react";

import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { MessageBubble } from "../components/ui/messageBubble";
import { ScrollArea } from "../components/ui/scrollArea";
import { Select } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Table } from "../components/ui/table";
import { Tabs } from "../components/ui/tabs";
import { Toast } from "../components/ui/toast";
import { Tooltip } from "../components/ui/tooltip";
import { TypingIndicator } from "../components/ui/typingIndicator";

type SectionProperties = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProperties): React.ReactElement {
  return (
    <section className="flex flex-col items-start gap-3">
      <h2 className="text-title font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

const MODEL_OPTIONS = [
  { value: "gemma-4-12b-qat", label: "google/gemma-4-12b-qat" },
  { value: "gemma-4-26b-a4b-qat", label: "google/gemma-4-26b-a4b-qat" },
];

const HOLDING_ROWS = [
  { symbol: "RAMCOSYS", exchange: "NSE", qty: 52, ltp: 612.4, pnl: 32_160 },
  { symbol: "GOLDBEES", exchange: "BSE", qty: 300, ltp: 68.2, pnl: -1_140 },
];

/**
 * CP3 component catalog — every Radix-backed primitive (Select, Switch,
 * Tabs, Dialog, Toast, Tooltip, ScrollArea) plus MessageBubble,
 * TypingIndicator, and Table, for visual verification. Supersedes CP1/CP2's
 * `/tokens` and `/primitives` pages as the single ongoing catalog going
 * forward (no barrel/index.ts export — CLAUDE.md bans barrel files, so
 * every consumer imports each primitive directly from its own module; this
 * page is the discoverability surface instead).
 * @returns Component catalog page element
 */
export function CatalogPreview(): React.ReactElement {
  const [model, setModel] = useState(MODEL_OPTIONS[0]?.value ?? "");
  const [dryRun, setDryRun] = useState(true);
  const [tab, setTab] = useState("brokers");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <Toast.Provider>
      <main className="flex min-h-dvh flex-col gap-8 bg-bg-base p-8 font-sans text-fg">
        <header className="flex flex-col gap-1">
          <h1 className="text-display font-semibold text-fg">CP3 component catalog</h1>
          <p className="text-body text-fg-muted">
            Radix-backed primitives + MessageBubble/TypingIndicator/Table, token-bound.
          </p>
        </header>

        <Section title="Select">
          <div className="max-w-xs">
            <Select
              id="catalog-model"
              label="Model"
              mono
              value={model}
              onChange={setModel}
              options={MODEL_OPTIONS}
            />
          </div>
        </Section>

        <Section title="Switch">
          <Switch id="catalog-dry-run" label="Dry-run mode" checked={dryRun} onChange={setDryRun} />
        </Section>

        <Section title="Tabs">
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Trigger value="brokers">Brokers</Tabs.Trigger>
              <Tabs.Trigger value="agent">Agent</Tabs.Trigger>
              <Tabs.Trigger value="danger">Danger zone</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="brokers" className="mt-3 text-body-sm text-fg-muted">
              Broker permissions panel.
            </Tabs.Content>
            <Tabs.Content value="agent" className="mt-3 text-body-sm text-fg-muted">
              Agent controls panel.
            </Tabs.Content>
            <Tabs.Content value="danger" className="mt-3 text-body-sm text-fg-muted">
              Danger zone panel.
            </Tabs.Content>
          </Tabs>
        </Section>

        <Section title="Dialog">
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Dialog.Trigger>
              <Button variant="destructive">Cancel GTT</Button>
            </Dialog.Trigger>
            <Dialog.Content
              title="Cancel this GTT order?"
              description="This can't be undone. The order will stop triggering immediately."
              tone="destructive"
            >
              <Dialog.Footer>
                <Button variant="ghost" onClick={(): void => setConfirmOpen(false)}>
                  Keep order
                </Button>
                <Button variant="destructive" onClick={(): void => setConfirmOpen(false)}>
                  Cancel order
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </Section>

        <Section title="Toast">
          <Button variant="secondary" onClick={(): void => setToastOpen(true)}>
            Save settings
          </Button>
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            title="Settings saved"
            description="PATCH /api/settings"
          />
        </Section>

        <Section title="Tooltip">
          <Tooltip content="Refresh portfolio data">
            <Button variant="icon" aria-label="Refresh">
              ↻
            </Button>
          </Tooltip>
        </Section>

        <Section title="ScrollArea">
          <ScrollArea className="h-32 max-w-sm rounded-lg border border-border-strong bg-surface-2">
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 10 }, (_, index) => (
                <p key={index} className="text-body-sm text-fg-muted">
                  Log line {index + 1}
                </p>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Section title="MessageBubble + TypingIndicator">
          <div className="flex max-w-md flex-col gap-2">
            <MessageBubble role="user">Ramco Systems buy 560-580 SL 520 Tgt 680 800+</MessageBubble>
            <MessageBubble role="assistant">
              <TypingIndicator />
            </MessageBubble>
          </div>
        </Section>

        <Section title="Table">
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Symbol</Table.HeaderCell>
                <Table.HeaderCell>Exchange</Table.HeaderCell>
                <Table.HeaderCell align="right">Qty</Table.HeaderCell>
                <Table.HeaderCell align="right">LTP</Table.HeaderCell>
                <Table.HeaderCell align="right">P&amp;L</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {HOLDING_ROWS.map((row) => (
                <Table.Row key={row.symbol}>
                  <Table.Cell className="font-mono uppercase">{row.symbol}</Table.Cell>
                  <Table.Cell>{row.exchange}</Table.Cell>
                  <Table.Cell align="right" numeric>
                    {row.qty}
                  </Table.Cell>
                  <Table.Cell align="right" numeric>
                    ₹{row.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Table.Cell>
                  <Table.Cell
                    align="right"
                    numeric
                    className={row.pnl >= 0 ? "text-pos" : "text-neg"}
                  >
                    {row.pnl >= 0 ? "+" : "−"}₹
                    {Math.abs(row.pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Section>
      </main>
    </Toast.Provider>
  );
}

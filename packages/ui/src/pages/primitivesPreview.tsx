import type React from "react";
import { useState } from "react";

import { Badge } from "../components/ui/badge";
import { Breadcrumb } from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { StatusDot } from "../components/ui/statusDot";
import { Textarea } from "../components/ui/textarea";

type SectionProperties = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProperties): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * CP2 primitives preview — every Button/Badge/Card/Input/Textarea/StatusDot/
 * Breadcrumb variant and state, for visual verification. CP3 folds this into
 * the fuller barrel-export component catalog (adds the Radix-backed set).
 * @returns Primitives preview page element
 */
export function PrimitivesPreview(): React.ReactElement {
  const [text, setText] = useState("");
  const [numeric, setNumeric] = useState("580");
  const [note, setNote] = useState("");
  const [apiKey, setApiKey] = useState("sk-live-example-key-value");

  return (
    <main className="flex min-h-dvh flex-col gap-8 bg-bg-base p-8 font-sans text-fg">
      <header className="flex flex-col gap-1">
        <h1 className="text-display font-semibold text-fg">CP2 primitives</h1>
        <p className="text-body text-fg-muted">
          Every variant and state, built only with token-bound Tailwind classes.
        </p>
      </header>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="icon" aria-label="Refresh">
            ↻
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="pos" dot>
            Active
          </Badge>
          <Badge variant="neg" dot>
            Breach
          </Badge>
          <Badge variant="warn" dot>
            Dry-run
          </Badge>
          <Badge variant="info" dot>
            Pending
          </Badge>
          <Badge variant="neutral">NSE</Badge>
          <Badge variant="neutral">MTF</Badge>
        </div>
      </Section>

      <Section title="Card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-body text-fg">Default card</p>
          </Card>
          <Card shadow>
            <p className="text-body text-fg">Elevated card (shadow-card)</p>
          </Card>
          <Card danger>
            <p className="text-body text-neg-soft">Danger card</p>
          </Card>
          <Card as="section">
            <p className="text-body text-fg">Section card</p>
          </Card>
        </div>
      </Section>

      <Section title="Input / Textarea">
        <div className="flex max-w-sm flex-col gap-4">
          <Input
            id="preview-text"
            label="Stock name"
            value={text}
            onChange={setText}
            placeholder="Ramco Systems"
          />
          <Input
            id="preview-numeric"
            label="Entry price"
            numeric
            value={numeric}
            onChange={setNumeric}
          />
          <Input
            id="preview-disabled"
            label="Disabled field"
            value="580"
            onChange={(): void => {}}
            disabled
          />
          <Input
            id="preview-api-key"
            label="API key"
            type="password"
            value={apiKey}
            onChange={setApiKey}
          />
          <Textarea
            id="preview-note"
            label="Notes"
            value={note}
            onChange={setNote}
            placeholder="Optional reasoning"
          />
        </div>
      </Section>

      <Section title="StatusDot">
        <div className="flex flex-wrap items-center gap-4">
          <StatusDot variant="pos" label="Connected" />
          <StatusDot variant="neg" label="SL breached" />
          <StatusDot variant="warn" label="Dry-run" />
          <StatusDot variant="info" label="Pending approval" />
        </div>
      </Section>

      <Section title="Breadcrumb">
        <Breadcrumb items={[{ label: "Ask Drishti", href: "/ask" }, { label: "Conversation" }]} />
      </Section>
    </main>
  );
}

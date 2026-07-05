import type React from "react";

import { Card } from "../ui/card";

// Fixed values from this repo's CLAUDE.md ("LM Studio is the primary LLM
// provider... Do NOT use OpenAI or any other cloud API") — not fetched from
// an endpoint, since there's no BYO-provider system and nothing to select.
const PROVIDER = "LM Studio (local)";
const MODEL = "google/gemma-4-12b-qat";
const ENDPOINT = "http://localhost:1234";

type ReadOnlyFieldProperties = {
  label: string;
  value: string;
};

function ReadOnlyField({ label, value }: ReadOnlyFieldProperties): React.ReactElement {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption text-fg-faint">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-body-sm text-fg-muted"
      />
    </label>
  );
}

/**
 * Model & runtime card (handoff.md §4 `ModelAccessForm.tsx`, scoped to what's
 * actually true) — the reference's bring-your-own-key multi-provider picker
 * (Anthropic/OpenAI/Google/local) doesn't apply here: this app is hardcoded
 * to a single local LM Studio model (CLAUDE.md's non-negotiable rule), so
 * this shows that fixed configuration as read-only fields instead of an
 * editable provider/model selector that would imply a choice the app
 * doesn't actually offer.
 * @returns Model & runtime card element
 */
export function ModelRuntimeCard(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Model & runtime</h2>

      <div className="grid grid-cols-1 gap-3 nav:grid-cols-2">
        <ReadOnlyField label="Provider" value={PROVIDER} />
        <ReadOnlyField label="Model" value={MODEL} />
      </div>
      <ReadOnlyField label="Endpoint" value={ENDPOINT} />

      <p className="text-caption text-fg-faint">
        Fixed for this deployment — no cloud LLM providers are used, so there&apos;s no
        provider/model picker or API key to configure.
      </p>
    </Card>
  );
}

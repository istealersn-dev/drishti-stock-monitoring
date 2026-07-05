import type React from "react";

import { Card } from "../ui/card";
import { Input } from "../ui/input";

// Fixed values from this repo's CLAUDE.md ("LM Studio is the primary LLM
// provider... Do NOT use OpenAI or any other cloud API") — not fetched from
// an endpoint, since there's no BYO-provider system and nothing to select.
const PROVIDER = "LM Studio (local)";
const MODEL = "google/gemma-4-12b-qat";
const ENDPOINT = "http://localhost:1234";

/** No-op — the fields below are `disabled`, so this is never actually invoked. */
function noop(): void {}

/**
 * Model & runtime card (handoff.md §4 `ModelAccessForm.tsx`, scoped to what's
 * actually true) — the reference's bring-your-own-key multi-provider picker
 * (Anthropic/OpenAI/Google/local) doesn't apply here: this app is hardcoded
 * to a single local LM Studio model (CLAUDE.md's non-negotiable rule), so
 * this shows that fixed configuration as disabled fields instead of an
 * editable provider/model selector that would imply a choice the app
 * doesn't actually offer.
 * @returns Model & runtime card element
 */
export function ModelRuntimeCard(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Model & runtime</h2>

      <div className="grid grid-cols-1 gap-3 nav:grid-cols-2">
        <Input id="model-provider" label="Provider" value={PROVIDER} onChange={noop} disabled />
        <Input id="model-name" label="Model" value={MODEL} onChange={noop} disabled />
      </div>
      <Input id="model-endpoint" label="Endpoint" value={ENDPOINT} onChange={noop} disabled />

      <p className="text-caption text-fg-faint">
        Fixed for this deployment — no cloud LLM providers are used, so there&apos;s no
        provider/model picker or API key to configure.
      </p>
    </Card>
  );
}

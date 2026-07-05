import type React from "react";

import { LM_ENDPOINT, LM_MODEL, LM_PROVIDER } from "../../lib/llmConfig";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

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
        <Input id="model-provider" label="Provider" value={LM_PROVIDER} onChange={noop} disabled />
        <Input id="model-name" label="Model" value={LM_MODEL} onChange={noop} disabled />
      </div>
      <Input id="model-endpoint" label="Endpoint" value={LM_ENDPOINT} onChange={noop} disabled />

      <p className="text-caption text-fg-faint">
        Fixed for this deployment — no cloud LLM providers are used, so there&apos;s no
        provider/model picker or API key to configure.
      </p>
    </Card>
  );
}

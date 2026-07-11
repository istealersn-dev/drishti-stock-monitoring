import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type React from "react";

import { PageHeader } from "../components/shell/pageHeader";
import { Badge, type BadgeVariant } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { activateBroker, fetchBrokers, verifyBroker } from "../lib/api";

// Kept in sync by hand with packages/agent/src/broker/brokerClient.registry.ts's
// IMPLEMENTED_BROKER_IDS — the backend is the enforcement point (verify/activate
// 501 for anything not in that list), this only decides whether the UI shows
// live setup steps or an honest "not built yet" placeholder.
const IMPLEMENTED_BROKER_IDS = new Set(["upstox"]);

type BrokerCopy = {
  name: string;
  instructions: string[];
};

const BROKER_COPY: Record<string, BrokerCopy> = {
  upstox: {
    name: "Upstox",
    instructions: [
      "Generate API credentials for your Upstox account at developer.upstox.com, if you haven't already.",
      "Set UPSTOX_API_KEY, UPSTOX_API_SECRET, and UPSTOX_TOTP_SECRET in packages/token-refresh/.env.local.",
      "Mint today's access token: cd packages/token-refresh && node --import tsx src/runDailyRefresh.ts",
      "Restart the agent so it picks up the new token: pm2 restart drishti-agent",
      'Come back here and click "Verify connection".',
    ],
  },
  groww: {
    name: "Groww",
    instructions: [
      "Groww support is planned but not built yet — there is no adapter behind this broker.",
      "Verifying or activating it will fail until that adapter ships.",
    ],
  },
};

function statusVariant(status: string): BadgeVariant {
  if (status === "connected") return "pos";
  if (status === "error") return "neg";
  return "neutral";
}

function statusLabel(status: string, isActive: boolean): string {
  const base = status === "not_configured" ? "Not configured" : status;
  return isActive ? `Active — ${base}` : base;
}

/**
 * Per-broker connect page (handoff.md §4 follow-on) — shows live connection
 * status, numbered setup instructions, and Verify/Activate actions. Credential
 * entry itself always happens out-of-band via .env/Keychain + token-refresh,
 * never through this page — see BROKER_COPY's instructions — so there's no
 * form here, only "do these steps elsewhere, then click Verify."
 * @returns Connect broker page element
 */
export function ConnectBroker(): React.ReactElement {
  const { brokerId } = useParams({ from: "/layout/settings/connect/$brokerId" });
  const queryClient = useQueryClient();

  const {
    data: brokers,
    isLoading,
    isError,
  } = useQuery({ queryKey: ["brokers"], queryFn: fetchBrokers });

  const broker = brokers?.find((b) => b.brokerId === brokerId);
  const copy = BROKER_COPY[brokerId] ?? {
    name: brokerId,
    instructions: ["Unknown broker — nothing to connect here."],
  };
  const implemented = IMPLEMENTED_BROKER_IDS.has(brokerId);
  const status = broker?.status ?? "not_configured";

  const verifyMutation = useMutation({
    mutationFn: () => verifyBroker(brokerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brokers"] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => activateBroker(brokerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brokers"] });
    },
  });

  const canActivate = implemented && status === "connected" && broker?.isActive !== true;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/settings"
        className="w-fit text-body-sm text-fg-muted transition-colors hover:text-fg"
      >
        ← Back to Settings
      </Link>

      <PageHeader
        title={`Connect ${copy.name}`}
        subtitle="Follow these steps outside the browser, then verify the connection here."
      />

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body-sm font-semibold text-fg">Status</h2>
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <Badge variant={statusVariant(status)} dot>
              {statusLabel(status, broker?.isActive ?? false)}
            </Badge>
          )}
        </div>
        {isError && <p className="text-body-sm text-neg">Could not load broker status.</p>}
        {broker?.lastCheckedAt && (
          <p className="text-caption text-fg-faint">
            Last checked {new Date(broker.lastCheckedAt).toLocaleString("en-IN")}
          </p>
        )}
        {broker?.lastError && <p className="text-caption text-neg">{broker.lastError}</p>}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-body-sm font-semibold text-fg">Setup steps</h2>
        <ol className="flex flex-col gap-2 text-body-sm text-fg-muted">
          {copy.instructions.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-mono text-fg-faint">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={!implemented || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending ? "Verifying…" : "Verify connection"}
        </Button>
        <Button
          variant="primary"
          disabled={!canActivate || activateMutation.isPending}
          onClick={() => activateMutation.mutate()}
        >
          {activateMutation.isPending
            ? "Activating…"
            : broker?.isActive === true
              ? "Active broker"
              : "Set as active broker"}
        </Button>
        {verifyMutation.isError && (
          <p className="text-body-sm text-neg">{(verifyMutation.error as Error).message}</p>
        )}
        {activateMutation.isError && (
          <p className="text-body-sm text-neg">{(activateMutation.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}

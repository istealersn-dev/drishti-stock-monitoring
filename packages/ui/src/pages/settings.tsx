import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { fetchSettings, updateSettings, type Settings } from "../lib/api";

type ToggleRowProperties = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProperties): React.ReactElement {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked);
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-[13px] font-medium text-text-primary">{label}</p>
        <p className="mt-0.5 text-[12px] text-text-muted">{description}</p>
      </div>
      <label className="relative flex h-5 w-9 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
        <div className="h-5 w-9 rounded-pill border border-border-default bg-bg-inset transition-colors peer-checked:border-primary/40 peer-checked:bg-primary-bg peer-disabled:opacity-50" />
        <div className="absolute left-0.5 h-4 w-4 rounded-full border border-border-dim bg-text-dim transition-all peer-checked:translate-x-4 peer-checked:border-primary/50 peer-checked:bg-primary-text" />
      </label>
    </div>
  );
}

/**
 * Settings page — dry-run toggle, pause agent, and display of read-only config.
 * @returns Settings page element
 */
export function Settings(): React.ReactElement {
  const queryClientInstance = useQueryClient();

  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      void queryClientInstance.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleDryRunChange = (value: boolean): void => {
    mutation.mutate({ dry_run: value ? "true" : "false" });
  };

  const handlePauseChange = (value: boolean): void => {
    mutation.mutate({ pause_agent: value ? "true" : "false" });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="animate-fade-drk max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[17px] font-semibold text-text-primary">Settings</h1>
        {mutation.isPending && <Spinner size="sm" />}
        {mutation.isError && <Badge variant="danger">Save failed</Badge>}
      </div>

      <Card accent="warning">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-warning">
          Safety Controls
        </p>
        <div className="divide-y divide-border-subtle">
          <ToggleRow
            label="Dry Run Mode"
            description="Skip all Upstox write calls. Actions are logged only."
            checked={settings.dryRun}
            onChange={handleDryRunChange}
            disabled={mutation.isPending}
          />
          <ToggleRow
            label="Pause Agent"
            description="Prevent the agent scheduler from starting new runs."
            checked={settings.pauseAgent}
            onChange={handlePauseChange}
            disabled={mutation.isPending}
          />
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Read-only Config
        </p>
        <div className="space-y-2 text-[13px]">
          <ConfigRow label="Poll Interval" value={`${String(settings.pollIntervalMinutes)} min`} />
          <ConfigRow label="Market Open" value={settings.marketOpen} />
          <ConfigRow label="Market Close" value={settings.marketClose} />
          <ConfigRow
            label="Approval Timeout"
            value={`${String(settings.approvalTimeoutMinutes)} min`}
          />
          <ConfigRow label="API Port" value={String(settings.apiPort)} />
        </div>
      </Card>
    </div>
  );
}

type ConfigRowProperties = {
  label: string;
  value: string;
};

function ConfigRow({ label, value }: ConfigRowProperties): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-secondary">{value}</span>
    </div>
  );
}

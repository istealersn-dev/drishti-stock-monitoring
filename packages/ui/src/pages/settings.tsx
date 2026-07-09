import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";

import { AgentControls } from "../components/settings/agentControls";
import { BrokerCard } from "../components/settings/brokerCard";
import { DangerZone } from "../components/settings/dangerZone";
import { ModelRuntimeCard } from "../components/settings/modelRuntimeCard";
import { PageHeader } from "../components/shell/pageHeader";
import { Spinner } from "../components/ui/spinner";
import { Tabs } from "../components/ui/tabs";
import { type Settings as SettingsType, fetchSettings, updateSettings } from "../lib/api";

type SettingsTab = "brokers" | "agent" | "runtime" | "danger";
const SETTINGS_TABS: SettingsTab[] = ["brokers", "agent", "runtime", "danger"];

function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab === value);
}

type FormState = {
  dryRun: boolean;
  pauseAgent: boolean;
  pollIntervalMinutes: number;
};

function formFromSettings(settings: SettingsType): FormState {
  return {
    dryRun: settings.dryRun,
    pauseAgent: settings.pauseAgent,
    pollIntervalMinutes: settings.pollIntervalMinutes,
  };
}

/**
 * Settings page (Design.md/handoff.md §3) — tabbed Brokers / Agent controls /
 * Model & runtime / Danger zone, matching the reference's desktop tab bar
 * (which isolates the danger zone behind its own tab rather than showing it
 * always-visible). Brokers and Model & runtime are scoped to what's
 * actually true rather than the reference's multi-broker/BYO-provider forms
 * — see BrokerCard/ModelRuntimeCard for why.
 * @returns Settings page element
 */
export function Settings(): React.ReactElement {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>("brokers");

  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const [form, setForm] = useState<FormState>({
    dryRun: false,
    pauseAgent: false,
    pollIntervalMinutes: 5,
  });

  useEffect(() => {
    if (settings) setForm(formFromSettings(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSave = (): void => {
    mutation.mutate({
      dry_run: form.dryRun ? "true" : "false",
      pause_agent: form.pauseAgent ? "true" : "false",
      poll_interval_minutes: String(form.pollIntervalMinutes),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || settings == null) {
    return (
      <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        subtitle="Manage agent behaviour and runtime for your Drishti deployment."
      />

      <Tabs
        value={tab}
        onChange={(value) => {
          if (isSettingsTab(value)) setTab(value);
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="brokers">Brokers</Tabs.Trigger>
          <Tabs.Trigger value="agent">Agent controls</Tabs.Trigger>
          <Tabs.Trigger value="runtime">Model & runtime</Tabs.Trigger>
          <Tabs.Trigger value="danger">Danger zone</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="brokers" className="mt-4">
          <BrokerCard />
        </Tabs.Content>

        <Tabs.Content value="agent" className="mt-4">
          <AgentControls
            settings={settings}
            dryRun={form.dryRun}
            pauseAgent={form.pauseAgent}
            pollIntervalMinutes={form.pollIntervalMinutes}
            onDryRunChange={(value) => {
              setForm((previous) => ({ ...previous, dryRun: value }));
            }}
            onPauseAgentChange={(value) => {
              setForm((previous) => ({ ...previous, pauseAgent: value }));
            }}
            onPollIntervalChange={(value) => {
              setForm((previous) => ({ ...previous, pollIntervalMinutes: value }));
            }}
            onSave={handleSave}
            isPending={mutation.isPending}
            isError={mutation.isError}
            isSuccess={mutation.isSuccess}
          />
        </Tabs.Content>

        <Tabs.Content value="runtime" className="mt-4">
          <ModelRuntimeCard />
        </Tabs.Content>

        <Tabs.Content value="danger" className="mt-4">
          <DangerZone />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}

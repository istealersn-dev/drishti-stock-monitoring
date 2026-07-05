import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { AgentControls } from "../components/settings/agentControls";
import { DangerZone } from "../components/settings/dangerZone";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { Tabs } from "../components/ui/tabs";
import { type Settings as SettingsType, fetchSettings, updateSettings } from "../lib/api";
import { clearKey } from "../lib/auth";

type SettingsTab = "agent" | "danger";

function isSettingsTab(value: string): value is SettingsTab {
  return value === "agent" || value === "danger";
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
 * Settings page (Design.md/handoff.md §3) — tabbed Agent controls / Danger
 * zone, matching the reference's desktop tab bar (which isolates the danger
 * zone behind its own tab rather than showing it always-visible). The
 * design spec's "Model & API access" (bring-your-own-key multi-provider
 * form) and Brokers section/tabs are intentionally omitted: this project is
 * hardcoded to a single local LM Studio provider (see repo CLAUDE.md), and
 * the real backend has no broker/provider data model to back a form like
 * that.
 * @returns Settings page element
 */
export function Settings(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>("agent");

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

  const handleSignOut = (): void => {
    clearKey();
    void navigate({ to: "/login" });
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
      <div>
        <h1 className="text-title font-semibold text-fg">Settings</h1>
        <p className="mt-1 text-body-sm text-fg-muted">
          Manage agent behaviour and runtime for your Drishti deployment.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={(value) => {
          if (isSettingsTab(value)) setTab(value);
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="agent">Agent controls</Tabs.Trigger>
          <Tabs.Trigger value="danger">Danger zone</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {tab === "agent" ? (
        <div className="grid grid-cols-1 items-start gap-3.5 nav:grid-cols-2">
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

          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="text-body-sm text-fg">Signed in via access key</div>
              <p className="mt-0.5 text-caption text-fg-faint">This device</p>
            </div>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </Card>
        </div>
      ) : (
        <DangerZone />
      )}
    </div>
  );
}

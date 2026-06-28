import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

import { Spinner } from "../components/ui/spinner";
import { type Settings, fetchSettings, updateSettings } from "../lib/api";
import { clearKey } from "../lib/auth";

const LM_STUDIO_MODEL = "google/gemma-4-26b-a4b-qat";

type ToggleRowProperties = {
  title: string;
  description: string;
  checked: boolean;
  accent?: "warning";
  onToggle: () => void;
  disabled: boolean;
};

function ToggleRow({
  title,
  description,
  checked,
  accent,
  onToggle,
  disabled,
}: ToggleRowProperties): React.ReactElement {
  const rowBg = checked && accent === "warning" ? "rgba(245,158,11,.06)" : "#161616";
  const rowBorder = checked && accent === "warning" ? "rgba(245,158,11,.4)" : "#2a2a2a";
  const textColor = checked && accent === "warning" ? "#f59e0b" : "var(--color-text-primary)";
  const trackBg = checked ? (accent === "warning" ? "#d97706" : "var(--color-primary)") : "#3a3a3a";
  const knobLeft = checked ? "24px" : "3px";

  return (
    <div
      className="settings-toggle-row"
      style={{
        background: rowBg,
        borderColor: rowBorder,
        marginBottom: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) onToggle();
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#8a8a8a", marginTop: 2 }}>{description}</div>
      </div>
      <div className="settings-toggle-track" style={{ background: trackBg }}>
        <div className="settings-toggle-knob" style={{ left: knobLeft }} />
      </div>
    </div>
  );
}

type DangerRowProperties = {
  title: string;
  description: string;
  buttonLabel: string;
  onAction: () => void;
};

function DangerRow({
  title,
  description,
  buttonLabel,
  onAction,
}: DangerRowProperties): React.ReactElement {
  return (
    <div className="danger-zone-row">
      <div>
        <div className="text-[12.5px] font-medium text-text-primary">{title}</div>
        <div className="mt-[2px] text-[11px] text-text-dim">{description}</div>
      </div>
      <button type="button" className="danger-btn" onClick={onAction}>
        {buttonLabel}
      </button>
    </div>
  );
}

type FormState = {
  dryRun: boolean;
  pauseAgent: boolean;
  pollIntervalMinutes: number;
};

function formFromSettings(settings: Settings): FormState {
  return {
    dryRun: settings.dryRun,
    pauseAgent: settings.pauseAgent,
    pollIntervalMinutes: settings.pollIntervalMinutes,
  };
}

/**
 * Settings page — agent controls + model info + danger zone in 2-column layout.
 * @returns Settings page element
 */
export function Settings(): React.ReactElement {
  const navigate = useNavigate();
  const queryClientInstance = useQueryClient();

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
      void queryClientInstance.invalidateQueries({ queryKey: ["settings"] });
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
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || settings == null) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="animate-fade-drk max-w-[1000px]">
      <div className="grid grid-cols-2 items-start gap-[14px]">
        {/* Left: agent controls */}
        <div className="flex flex-col gap-[14px]">
          <div className="settings-card">
            <div className="mb-[14px] text-[13px] font-semibold text-text-primary">
              Agent controls
            </div>

            <ToggleRow
              title={`Dry Run ${form.dryRun ? "ON" : "OFF"}`}
              description="No real orders will be placed"
              checked={form.dryRun}
              accent="warning"
              onToggle={() => {
                setForm((previous) => ({ ...previous, dryRun: !previous.dryRun }));
              }}
              disabled={mutation.isPending}
            />

            <ToggleRow
              title="Pause agent"
              description={
                form.pauseAgent
                  ? "Scheduler halted — no new runs"
                  : "Scheduler active — polls on schedule"
              }
              checked={form.pauseAgent}
              onToggle={() => {
                setForm((previous) => ({ ...previous, pauseAgent: !previous.pauseAgent }));
              }}
              disabled={mutation.isPending}
            />

            {/* Poll interval slider */}
            <div className="mb-4 mt-2">
              <div className="mb-[9px] flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-text-secondary">Poll interval</span>
                <span className="font-mono text-[13px] text-primary-text">
                  {form.pollIntervalMinutes} min
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={form.pollIntervalMinutes}
                onChange={(event) => {
                  setForm((previous) => ({
                    ...previous,
                    pollIntervalMinutes: Number(event.target.value),
                  }));
                }}
                className="w-full cursor-pointer"
                style={{ accentColor: "#6366f1", height: 4 }}
              />
              <div className="mt-[5px] flex justify-between font-mono text-[10px] text-text-ghost">
                <span>1 min</span>
                <span>30 min</span>
              </div>
            </div>

            {/* Read-only: market hours + timeout */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-[6px] text-[11.5px] text-text-dim">Market open</div>
                <input
                  type="text"
                  value={settings.marketOpen}
                  readOnly
                  className="settings-text-input opacity-60"
                />
              </div>
              <div>
                <div className="mb-[6px] text-[11.5px] text-text-dim">Market close</div>
                <input
                  type="text"
                  value={settings.marketClose}
                  readOnly
                  className="settings-text-input opacity-60"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-[6px] text-[11.5px] text-text-dim">
                Auto-reject approvals after
              </div>
              <div className="flex items-center gap-[9px]">
                <input
                  type="text"
                  value={settings.approvalTimeoutMinutes}
                  readOnly
                  className="settings-text-input w-[80px] text-center opacity-60"
                />
                <span className="text-[12.5px] text-text-tertiary">minutes</span>
              </div>
            </div>

            {mutation.isError && (
              <div className="mb-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger-text">
                Failed to save settings
              </div>
            )}
            {mutation.isSuccess && (
              <div className="mb-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12px] text-success-text">
                Settings saved
              </div>
            )}

            <button
              type="button"
              className="settings-save-btn"
              disabled={mutation.isPending}
              onClick={handleSave}
            >
              {mutation.isPending ? <Spinner size="sm" /> : "Save settings"}
            </button>
          </div>
        </div>

        {/* Right: model info + danger zone */}
        <div className="flex flex-col gap-[14px]">
          {/* Model & runtime */}
          <div className="settings-card">
            <div className="text-[13px] font-semibold text-text-primary">Model &amp; runtime</div>
            <div className="mb-[14px] mt-[4px] text-[11px] text-text-dim">Read-only</div>
            <div>
              <div className="settings-info-row">
                <span className="text-[12.5px] text-text-tertiary">Model</span>
                <span className="font-mono text-[12.5px] text-[#e0e0e0]">{LM_STUDIO_MODEL}</span>
              </div>
              <div className="settings-info-row">
                <span className="text-[12.5px] text-text-tertiary">Provider</span>
                <span className="font-mono text-[12.5px] text-[#e0e0e0]">LM Studio</span>
              </div>
              <div className="settings-info-row">
                <span className="text-[12.5px] text-text-tertiary">API port</span>
                <span className="font-mono text-[12.5px] text-[#e0e0e0]">{settings.apiPort}</span>
              </div>
              <div className="settings-info-row" style={{ borderBottom: "none" }}>
                <span className="text-[12.5px] text-text-tertiary">Tunnel</span>
                <span className="font-mono text-[12.5px] text-[#e0e0e0]">Cloudflare</span>
              </div>
            </div>

            {/* Sign out */}
            <div className="mt-[14px] flex items-center justify-between gap-3 border-t border-[#232323] pt-[13px]">
              <div>
                <div className="text-[12.5px] text-[#e0e0e0]">Signed in via access key</div>
                <div className="mt-[2px] text-[11px] text-text-dim">
                  This device · Cloudflare Tunnel session
                </div>
              </div>
              <button
                type="button"
                className="flex flex-none cursor-pointer items-center gap-[6px] rounded-lg border border-border-subtle bg-[#161616] px-3 py-[7px] text-[12px] font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary-text"
                onClick={handleSignOut}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div
            className="settings-card flex flex-col gap-[10px]"
            style={{ borderColor: "rgba(239,68,68,.4)" }}
          >
            <div className="text-[13px] font-semibold text-danger">Danger zone</div>
            <div className="mb-[4px] text-[11px] text-[#8a6a6a]">
              Irreversible actions. Proceed with caution.
            </div>
            <DangerRow
              title="Cancel all active GTTs"
              description="Removes every pending trigger order"
              buttonLabel="Cancel all"
              onAction={() => {
                window.alert("Not yet wired — cancel all GTTs action pending backend endpoint.");
              }}
            />
            <DangerRow
              title="Reset agent logs"
              description="Permanently clears the audit trail"
              buttonLabel="Reset logs"
              onAction={() => {
                window.alert("Not yet wired — reset logs action pending backend endpoint.");
              }}
            />
            <DangerRow
              title="Reject all pending approvals"
              description="Declines every approval awaiting decision"
              buttonLabel="Reject all"
              onAction={() => {
                window.alert(
                  "Not yet wired — reject all approvals action pending backend endpoint.",
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

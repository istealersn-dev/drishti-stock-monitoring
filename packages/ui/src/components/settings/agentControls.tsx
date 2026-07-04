import type React from "react";

import type { Settings } from "../../lib/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";

const POLL_INTERVAL_MIN = 1;
const POLL_INTERVAL_MAX = 30;

type AgentControlsProperties = {
  settings: Settings;
  dryRun: boolean;
  pauseAgent: boolean;
  pollIntervalMinutes: number;
  onDryRunChange: (value: boolean) => void;
  onPauseAgentChange: (value: boolean) => void;
  onPollIntervalChange: (value: number) => void;
  onSave: () => void;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
};

/**
 * Agent controls card (handoff.md §4 `AgentControls.tsx`) — dry-run and
 * pause-agent toggles, poll interval slider, and read-only market
 * hours/approval-timeout fields sourced from the agent's env config.
 * @param props.settings - the fetched agent settings (for read-only fields)
 * @param props.dryRun - controlled dry-run toggle state
 * @param props.pauseAgent - controlled pause-agent toggle state
 * @param props.pollIntervalMinutes - controlled poll interval in minutes
 * @param props.onDryRunChange - dry-run toggle change handler
 * @param props.onPauseAgentChange - pause-agent toggle change handler
 * @param props.onPollIntervalChange - poll interval change handler
 * @param props.onSave - called when Save settings is clicked
 * @param props.isPending - whether the save mutation is in flight
 * @param props.isError - whether the last save attempt failed
 * @param props.isSuccess - whether the last save attempt succeeded
 * @returns Agent controls card element
 */
export function AgentControls({
  settings,
  dryRun,
  pauseAgent,
  pollIntervalMinutes,
  onDryRunChange,
  onPauseAgentChange,
  onPollIntervalChange,
  onSave,
  isPending,
  isError,
  isSuccess,
}: AgentControlsProperties): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Agent controls</h2>

      <div
        className={`flex items-center justify-between rounded-xl border p-3 ${dryRun ? "border-warn-ring bg-warn-tint" : "border-border-strong bg-surface-2"}`}
      >
        <div>
          <div className={`text-body-sm font-medium ${dryRun ? "text-warn" : "text-fg"}`}>
            Dry Run {dryRun ? "ON" : "OFF"}
          </div>
          <p className="mt-0.5 text-caption text-fg-faint">
            Updates agent config — real-order gating also depends on the DRISHTI_DRY_RUN environment
            variable set at process start
          </p>
        </div>
        <Switch
          id="dry-run"
          label="Dry Run"
          hideLabel
          checked={dryRun}
          onChange={onDryRunChange}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border-strong bg-surface-2 p-3">
        <div>
          <div className="text-body-sm font-medium text-fg">Pause agent</div>
          <p className="mt-0.5 text-caption text-fg-faint">
            {pauseAgent
              ? "Poll tick paused — no new SL/target checks or analysis"
              : "Poll tick active — checks SL/targets on schedule"}
          </p>
        </div>
        <Switch
          id="pause-agent"
          label="Pause agent"
          hideLabel
          checked={pauseAgent}
          onChange={onPauseAgentChange}
          disabled={isPending}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="poll-interval" className="text-body-sm font-medium text-fg-muted">
            Poll interval
          </label>
          <span className="font-mono text-body-sm text-fg">{pollIntervalMinutes} min</span>
        </div>
        <input
          id="poll-interval"
          type="range"
          min={POLL_INTERVAL_MIN}
          max={POLL_INTERVAL_MAX}
          step={1}
          value={pollIntervalMinutes}
          disabled={isPending}
          onChange={(event) => {
            onPollIntervalChange(Number(event.target.value));
          }}
          className="w-full accent-gold disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-1 flex justify-between font-mono text-micro text-fg-faint">
          <span>{POLL_INTERVAL_MIN} min</span>
          <span>{POLL_INTERVAL_MAX} min</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-fg-faint">Market open</span>
          <input
            type="text"
            value={settings.marketOpen}
            readOnly
            className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-body-sm text-fg-muted"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-fg-faint">Market close</span>
          <input
            type="text"
            value={settings.marketClose}
            readOnly
            className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 font-mono text-body-sm text-fg-muted"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-fg-faint">Auto-reject approvals after</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={settings.approvalTimeoutMinutes}
            readOnly
            className="h-9 w-20 rounded-lg border border-border-strong bg-surface-2 px-3 text-center font-mono text-body-sm text-fg-muted"
          />
          <span className="text-body-sm text-fg-muted">minutes</span>
        </div>
      </label>

      {isError && <p className="text-caption text-neg">Failed to save settings</p>}
      {isSuccess && <p className="text-caption text-pos">Settings saved</p>}

      <Button variant="primary" disabled={isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </Card>
  );
}

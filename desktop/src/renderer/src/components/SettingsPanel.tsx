import { useEffect, useState } from "react";
import type { BackendLaunchConfig, BackendStatus, HostInfo, SettingsState } from "../lib/types";

type Props = {
  settings: SettingsState;
  backendLaunchConfig: BackendLaunchConfig | null;
  backendStatus: BackendStatus | null;
  hostInfo: HostInfo | null;
  onApplyBackendLaunchConfig: (config: BackendLaunchConfig) => Promise<void>;
  onChange: (settings: SettingsState) => void;
};

export function SettingsPanel({
  settings,
  backendLaunchConfig,
  backendStatus,
  hostInfo,
  onApplyBackendLaunchConfig,
  onChange
}: Props) {
  const [launchDraft, setLaunchDraft] = useState<BackendLaunchConfig | null>(backendLaunchConfig);

  useEffect(() => {
    setLaunchDraft(backendLaunchConfig);
  }, [backendLaunchConfig]);

  const canShowMpsControls = hostInfo?.isAppleSiliconMac && launchDraft;
  const isApplyDisabled =
    !launchDraft ||
    !backendLaunchConfig ||
    backendStatus?.status === "starting" ||
    JSON.stringify(launchDraft) === JSON.stringify(backendLaunchConfig);

  return (
    <div className="card">
      <div className="panel-header">
        <h2>Inference Settings</h2>
      </div>
      <label>
        <span>Linear input</span>
        <input
          type="checkbox"
          checked={settings.inputIsLinear}
          onChange={(event) => onChange({ ...settings, inputIsLinear: event.target.checked })}
        />
      </label>
      <label>
        <span>Despill strength</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.despillStrength}
          onChange={(event) => onChange({ ...settings, despillStrength: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>Auto despeckle</span>
        <input
          type="checkbox"
          checked={settings.autoDespeckle}
          onChange={(event) => onChange({ ...settings, autoDespeckle: event.target.checked })}
        />
      </label>
      <label>
        <span>Despeckle size</span>
        <input
          type="number"
          min={0}
          value={settings.despeckleSize}
          onChange={(event) => onChange({ ...settings, despeckleSize: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>Refiner scale</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={settings.refinerScale}
          onChange={(event) => onChange({ ...settings, refinerScale: Number(event.target.value) })}
        />
      </label>
      {canShowMpsControls ? (
        <>
          <div className="panel-header">
            <h2>Apple Silicon</h2>
          </div>
          <p className="settings-hint">These toggles restart the Python backend. They only appear on Apple Silicon Macs.</p>
          <label>
            <span>Enable fast math</span>
            <input
              type="checkbox"
              checked={launchDraft.enableMpsFastMath}
              onChange={(event) => setLaunchDraft({ ...launchDraft, enableMpsFastMath: event.target.checked })}
            />
          </label>
          <label>
            <span>Prefer Metal kernels</span>
            <input
              type="checkbox"
              checked={launchDraft.enableMpsPreferMetal}
              onChange={(event) => setLaunchDraft({ ...launchDraft, enableMpsPreferMetal: event.target.checked })}
            />
          </label>
          <label>
            <span>High watermark ratio</span>
            <input
              type="text"
              placeholder="Optional, e.g. 0.0"
              value={launchDraft.mpsHighWatermarkRatio}
              onChange={(event) => setLaunchDraft({ ...launchDraft, mpsHighWatermarkRatio: event.target.value })}
            />
          </label>
          <button type="button" disabled={isApplyDisabled} onClick={() => void onApplyBackendLaunchConfig(launchDraft)}>
            Apply & Restart Backend
          </button>
        </>
      ) : null}
    </div>
  );
}

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
    <div className="card settings-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Recipe</p>
          <h2>Inference Settings</h2>
        </div>
      </div>
      <p className="settings-hint">These controls affect previews and inference runs. Start with the defaults unless you know the plate needs special handling.</p>

      <div className="settings-group">
        <h3>Plate assumptions</h3>
        <label className="setting-row">
          <div>
            <span>Linear input</span>
            <p>Enable this only when the incoming plate is already linear.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.inputIsLinear}
            onChange={(event) => onChange({ ...settings, inputIsLinear: event.target.checked })}
          />
        </label>
      </div>

      <div className="settings-group">
        <h3>Cleanup</h3>
        <label className="setting-row">
          <div>
            <span>Despill strength</span>
            <p>Higher values remove more green contamination from the foreground.</p>
          </div>
          <div className="setting-control">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.despillStrength}
              onChange={(event) => onChange({ ...settings, despillStrength: Number(event.target.value) })}
            />
            <strong>{settings.despillStrength.toFixed(2)}</strong>
          </div>
        </label>
        <label className="setting-row">
          <div>
            <span>Auto despeckle</span>
            <p>Removes tiny disconnected islands from the matte automatically.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoDespeckle}
            onChange={(event) => onChange({ ...settings, autoDespeckle: event.target.checked })}
          />
        </label>
        <label className="setting-row">
          <div>
            <span>Despeckle size</span>
            <p>Maximum particle size to prune when auto despeckle is enabled.</p>
          </div>
          <input
            type="number"
            min={0}
            value={settings.despeckleSize}
            onChange={(event) => onChange({ ...settings, despeckleSize: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="settings-group">
        <h3>Detail recovery</h3>
        <label className="setting-row">
          <div>
            <span>Refiner scale</span>
            <p>Controls how aggressively the model leans into fine detail recovery.</p>
          </div>
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.refinerScale}
            onChange={(event) => onChange({ ...settings, refinerScale: Number(event.target.value) })}
          />
        </label>
      </div>

      {canShowMpsControls ? (
        <details className="advanced-panel">
          <summary>Apple Silicon backend tuning</summary>
          <p className="settings-hint">These toggles restart the Python backend and are only relevant on Apple Silicon Macs.</p>
          <label className="setting-row">
            <div>
              <span>Enable fast math</span>
              <p>Lets PyTorch use faster but slightly less exact math on MPS.</p>
            </div>
            <input
              type="checkbox"
              checked={launchDraft.enableMpsFastMath}
              onChange={(event) => setLaunchDraft({ ...launchDraft, enableMpsFastMath: event.target.checked })}
            />
          </label>
          <label className="setting-row">
            <div>
              <span>Prefer Metal kernels</span>
              <p>Biases MPS workloads toward Metal kernels when available.</p>
            </div>
            <input
              type="checkbox"
              checked={launchDraft.enableMpsPreferMetal}
              onChange={(event) => setLaunchDraft({ ...launchDraft, enableMpsPreferMetal: event.target.checked })}
            />
          </label>
          <label className="setting-row">
            <div>
              <span>High watermark ratio</span>
              <p>Optional override for the MPS memory allocator limit.</p>
            </div>
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
        </details>
      ) : null}
    </div>
  );
}

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

  const canShowAppleSiliconControls = hostInfo?.isAppleSiliconMac && launchDraft;
  const isTorchBackend = launchDraft?.backendMode === "torch";
  const isApplyDisabled =
    !launchDraft ||
    !backendLaunchConfig ||
    backendStatus?.status === "starting" ||
    JSON.stringify(launchDraft) === JSON.stringify(backendLaunchConfig);

  return (
    <div className="card settings-card">
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-group">
        <h3>Plate assumptions</h3>
        <label className="setting-row">
          <div>
            <span>Linear input</span>
            <p>Enable only when the incoming plate is already linear.</p>
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
            <p>Higher values remove more green contamination.</p>
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
            <p>Remove tiny disconnected matte islands.</p>
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
            <p>Max particle size to prune.</p>
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
            <span>Output resolution</span>
            <p>Auto uses the recommended engine size for the current device; higher values recover more detail.</p>
          </div>
          <select
            value={String(settings.imgSize)}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange({
                ...settings,
                imgSize:
                  nextValue === "auto" ? "auto" : (Number(nextValue) as 1024 | 1536 | 2048)
              });
            }}
          >
            <option value="auto">Auto (recommended)</option>
            <option value="1024">1024</option>
            <option value="1536">1536</option>
            <option value="2048">2048</option>
          </select>
        </label>
        <label className="setting-row">
          <div>
            <span>Refiner scale</span>
            <p>Controls fine detail recovery aggressiveness.</p>
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

      {canShowAppleSiliconControls ? (
        <details className="advanced-panel">
          <summary>Apple Silicon backend</summary>
          <p className="settings-hint">
            Choose between Torch + MPS and MLX. Changes here restart the Python backend.
          </p>
          <label className="setting-row">
            <div>
              <span>Backend engine</span>
              <p>
                Torch uses PyTorch + MPS. MLX uses the native Apple Silicon path when the MLX package and
                weights are present.
              </p>
            </div>
            <select
              aria-label="Backend engine"
              value={launchDraft.backendMode}
              onChange={(event) =>
                setLaunchDraft({
                  ...launchDraft,
                  backendMode: event.target.value as "torch" | "mlx"
                })
              }
            >
              <option value="torch">Torch + MPS</option>
              <option value="mlx">MLX</option>
            </select>
          </label>
          {isTorchBackend ? (
            <>
              <label className="setting-row">
                <div>
                  <span>Fast math</span>
                  <p>Faster but slightly less exact MPS math.</p>
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
                  <p>Bias MPS workloads toward Metal when available.</p>
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
                  <p>MPS memory allocator limit override.</p>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 0.0"
                  value={launchDraft.mpsHighWatermarkRatio}
                  onChange={(event) => setLaunchDraft({ ...launchDraft, mpsHighWatermarkRatio: event.target.value })}
                />
              </label>
            </>
          ) : (
            <p className="settings-hint">
              MLX bypasses the PyTorch MPS allocator, so the MPS tuning controls are hidden while MLX is selected.
            </p>
          )}
          <button type="button" disabled={isApplyDisabled} onClick={() => void onApplyBackendLaunchConfig(launchDraft)}>
            Apply &amp; restart backend
          </button>
        </details>
      ) : null}
    </div>
  );
}

import type { SettingsState } from "../lib/types";

type Props = {
  settings: SettingsState;
  onChange: (settings: SettingsState) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
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
    </div>
  );
}

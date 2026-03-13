import type { ClipDto } from "../lib/types";
import {
  actionLabels,
  formatClipState,
  summarizeWorkflow,
  type AlphaGeneratorActionKind,
  type ClipActionKind
} from "../lib/workflow";

type Props = {
  clip: ClipDto | null;
  onRunAction: (action: ClipActionKind) => void;
  selectedAlphaGenerator: AlphaGeneratorActionKind | null;
  onSelectAlphaGenerator: (action: AlphaGeneratorActionKind) => void;
  onOpenClip: () => void;
  onOpenOutput: () => void;
};

function stagePillClass(state: string): string {
  switch (state) {
    case "READY":
      return "state-pill state-pill-ready";
    case "COMPLETE":
      return "state-pill state-pill-complete";
    case "ERROR":
      return "state-pill state-pill-error";
    case "EXTRACTING":
    case "MASKED":
      return "state-pill state-pill-warn";
    default:
      return "state-pill state-pill-emphasis";
  }
}

function isAlphaGeneratorAction(action: ClipActionKind): action is AlphaGeneratorActionKind {
  return action === "gvm" || action === "rvm" || action === "videomama";
}

export function WorkflowPanel({
  clip,
  onRunAction,
  selectedAlphaGenerator,
  onSelectAlphaGenerator,
  onOpenClip,
  onOpenOutput
}: Props) {
  const workflow = summarizeWorkflow(clip);
  const alphaGeneratorActions = clip
    ? (clip.availableActions.filter((action): action is AlphaGeneratorActionKind =>
        action === "gvm" || action === "rvm" || action === "videomama"
      ))
    : [];
  const showAlphaGeneratorSelector = alphaGeneratorActions.length > 0;
  const effectiveAlphaGenerator =
    selectedAlphaGenerator && alphaGeneratorActions.includes(selectedAlphaGenerator)
      ? selectedAlphaGenerator
      : (alphaGeneratorActions[0] ?? null);
  const canRunInference = clip?.availableActions.includes("inference") ?? false;
  const secondaryActions = workflow.secondaryActions.filter(
    (action) => !isAlphaGeneratorAction(action.action) && action.action !== "inference"
  );

  return (
    <section className="card workflow-card">
      <div className="workflow-hero">
        <div>
          <p className="eyebrow">Next step</p>
          <h2>{workflow.headline}</h2>
          <p className="workflow-copy">{workflow.description}</p>
        </div>
        <span className={clip ? stagePillClass(clip.state) : "state-pill state-pill-emphasis"}>
          {workflow.stageLabel}
        </span>
      </div>

      {clip ? (
        <div className="workflow-metadata">
          <div>
            <span className="meta-label">State</span>
            <strong>{formatClipState(clip.state)}</strong>
          </div>
          <div>
            <span className="meta-label">Input</span>
            <strong>{clip.inputType ?? "unknown"}</strong>
          </div>
          <div>
            <span className="meta-label">Frames</span>
            <strong>{clip.frameCount}</strong>
          </div>
          <div>
            <span className="meta-label">Alpha hints</span>
            <strong>{clip.alphaFrameCount}</strong>
          </div>
        </div>
      ) : null}

      {showAlphaGeneratorSelector && effectiveAlphaGenerator ? (
        <label className="workflow-selector" htmlFor="alpha-generator-select">
          <div>
            <span className="meta-label">Alpha model</span>
            <p className="workflow-copy">Choose which generator creates the coarse hint before CorridorKey runs.</p>
          </div>
          <select
            id="alpha-generator-select"
            value={effectiveAlphaGenerator}
            onChange={(event) => onSelectAlphaGenerator(event.target.value as AlphaGeneratorActionKind)}
          >
            {alphaGeneratorActions.map((action) => (
              <option key={action} value={action}>
                {actionLabels[action]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="workflow-actions">
        {effectiveAlphaGenerator ? (
          <button type="button" onClick={() => onRunAction(effectiveAlphaGenerator)}>
            {actionLabels[effectiveAlphaGenerator]}
          </button>
        ) : null}
        <button type="button" className="primary-button" disabled={!canRunInference} onClick={() => onRunAction("inference")}>
          {actionLabels.inference}
        </button>
        <div className="action-cluster">
          {secondaryActions.map((action) => (
            <button key={action.action} type="button" onClick={() => onRunAction(action.action)}>
              {action.label}
            </button>
          ))}
          {clip ? (
            <>
              <button type="button" className="ghost-button" onClick={onOpenClip}>
                Open clip folder
              </button>
              <button type="button" className="ghost-button" onClick={onOpenOutput}>
                Open output
              </button>
            </>
          ) : null}
        </div>
      </div>

      {workflow.issues.length > 0 ? (
        <div className="issue-stack">
          <h3 className="eyebrow" style={{ margin: 0 }}>Attention</h3>
          {workflow.issues.map((issue, index) => (
            <div key={`${issue.code}-${index}`} className={`issue-card issue-${issue.severity}`}>
              <strong>{issue.message}</strong>
              {issue.path ? <span>{issue.path}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

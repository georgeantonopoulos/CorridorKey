import type { ClipDto } from "../lib/types";
import { formatClipState, summarizeWorkflow, type ClipActionKind } from "../lib/workflow";

type Props = {
  clip: ClipDto | null;
  onRunAction: (action: ClipActionKind) => void;
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

export function WorkflowPanel({ clip, onRunAction, onOpenClip, onOpenOutput }: Props) {
  const workflow = summarizeWorkflow(clip);
  const primaryAction = workflow.primaryAction;

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

      <div className="workflow-actions">
        {primaryAction ? (
          <button type="button" className="primary-button" onClick={() => onRunAction(primaryAction.action)}>
            {primaryAction.label}
          </button>
        ) : (
          <span className="inline-note">No pipeline step available yet.</span>
        )}
        <div className="action-cluster">
          {workflow.secondaryActions.map((action) => (
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

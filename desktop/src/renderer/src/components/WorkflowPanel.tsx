import type { ClipDto } from "../lib/types";
import { formatClipState, summarizeWorkflow, type ClipActionKind } from "../lib/workflow";

type Props = {
  clip: ClipDto | null;
  onRunAction: (action: ClipActionKind) => void;
  onOpenClip: () => void;
  onOpenOutput: () => void;
};

export function WorkflowPanel({ clip, onRunAction, onOpenClip, onOpenOutput }: Props) {
  const workflow = summarizeWorkflow(clip);
  const primaryAction = workflow.primaryAction;

  return (
    <section className="card workflow-card">
      <div className="workflow-hero">
        <div>
          <p className="eyebrow">Workflow Guide</p>
          <h2>{workflow.headline}</h2>
          <p className="workflow-copy">{workflow.description}</p>
        </div>
        <span className="state-pill state-pill-emphasis">{workflow.stageLabel}</span>
      </div>

      {clip ? (
        <div className="workflow-metadata">
          <div>
            <span className="meta-label">Clip state</span>
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
            <span className="meta-label">Alpha frames</span>
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
          <div className="inline-note">No pipeline step is available yet for this clip.</div>
        )}
        <div className="action-cluster">
          {workflow.secondaryActions.map((action) => (
            <button key={action.action} type="button" onClick={() => onRunAction(action.action)}>
              {action.label}
            </button>
          ))}
          {clip ? (
            <>
              <button type="button" onClick={onOpenClip}>
                Open clip folder
              </button>
              <button type="button" onClick={onOpenOutput}>
                Open output folder
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="issue-stack">
        <div className="panel-header">
          <h3>What needs attention</h3>
        </div>
        {workflow.issues.length ? (
          workflow.issues.map((issue, index) => (
            <div key={`${issue.code}-${index}`} className={`issue-card issue-${issue.severity}`}>
              <strong>{issue.message}</strong>
              <span>{issue.path ?? issue.code}</span>
            </div>
          ))
        ) : (
          <div className="issue-card issue-info">
            <strong>No blockers detected.</strong>
            <span>The selected clip looks ready for its next workflow step.</span>
          </div>
        )}
      </div>
    </section>
  );
}

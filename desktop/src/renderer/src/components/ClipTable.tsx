import type { ClipDto } from "../lib/types";
import { formatClipState } from "../lib/workflow";

type Props = {
  clips: ClipDto[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
};

function clipStatePillClass(state: string): string {
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
      return "state-pill";
  }
}

function readinessLabel(clip: ClipDto): string {
  if (clip.state === "COMPLETE") return "Done";
  if (clip.state === "ERROR") return "Failed";
  if (clip.validationIssues.length) return clip.validationIssues[0]?.message ?? "Needs review";
  return "Ready";
}

export function ClipTable({ clips, selectedClipId, onSelectClip }: Props) {
  return (
    <div className="card">
      <div className="panel-header">
        <h2>Clips</h2>
        <span className="count-chip">{clips.length} total</span>
      </div>
      {clips.length === 0 ? (
        <p className="inline-note">No clips in this project yet.</p>
      ) : (
        <table className="clip-table">
          <thead>
            <tr>
              <th>Clip</th>
              <th>Stage</th>
              <th>Input</th>
              <th>Frames</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clips.map((clip) => (
              <tr
                key={clip.id}
                className={clip.id === selectedClipId ? "selected" : ""}
                onClick={() => onSelectClip(clip.id)}
              >
                <td>{clip.name}</td>
                <td>
                  <span className={clipStatePillClass(clip.state)}>{formatClipState(clip.state)}</span>
                </td>
                <td>{clip.inputType ?? "—"}</td>
                <td>{clip.frameCount}</td>
                <td>{readinessLabel(clip)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

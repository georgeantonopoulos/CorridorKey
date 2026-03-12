import type { ClipDto } from "../lib/types";

type Props = {
  clips: ClipDto[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
};

export function ClipTable({ clips, selectedClipId, onSelectClip }: Props) {
  return (
    <div className="card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Project Contents</p>
          <h2>Clips</h2>
        </div>
        <span className="count-chip">{clips.length} total</span>
      </div>
      <table className="clip-table">
        <thead>
          <tr>
            <th>Clip</th>
            <th>Stage</th>
            <th>Input</th>
            <th>Frames</th>
            <th>Readiness</th>
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
                <span className="state-pill">{clip.state.toLowerCase()}</span>
              </td>
              <td>{clip.inputType ?? "unknown"}</td>
              <td>{clip.frameCount}</td>
              <td>{clip.validationIssues.length ? clip.validationIssues[0]?.message ?? "Needs review" : "Ready for next step"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

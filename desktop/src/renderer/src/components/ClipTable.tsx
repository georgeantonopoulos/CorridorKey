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
        <h2>Clips</h2>
      </div>
      <table className="clip-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            <th>Source</th>
            <th>Frames</th>
            <th>Issues</th>
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
              <td>{clip.state}</td>
              <td>{clip.inputType ?? "unknown"}</td>
              <td>{clip.frameCount}</td>
              <td>{clip.validationIssues.length ? clip.validationIssues.map((issue) => issue.message).join(" | ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

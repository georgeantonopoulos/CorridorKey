import type { JobDto } from "../lib/types";

type Props = {
  jobs: JobDto[];
  onCancel: (jobId: string) => void;
};

export function QueuePanel({ jobs, onCancel }: Props) {
  return (
    <div className="card">
      <div className="panel-header">
        <h2>Queue</h2>
      </div>
      <div className="queue-list">
        {jobs.map((job) => {
          const percent = job.totalFrames > 0 ? Math.round((job.currentFrame / job.totalFrames) * 100) : 0;
          return (
            <div key={job.id} className="queue-item">
              <div className="queue-head">
                <strong>{job.clipName}</strong>
                <span>{job.jobType}</span>
              </div>
              <div className="queue-meta">
                <span>{job.status}</span>
                <span>{job.phaseLabel ?? "waiting"}</span>
              </div>
              <progress value={job.currentFrame} max={Math.max(job.totalFrames, 1)} />
              <div className="queue-meta">
                <span>
                  {job.currentFrame}/{job.totalFrames} ({percent}%)
                </span>
                {job.status === "running" || job.status === "queued" ? (
                  <button onClick={() => onCancel(job.id)}>Cancel</button>
                ) : null}
              </div>
              {job.errorMessage ? <div className="queue-error">{job.errorMessage}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

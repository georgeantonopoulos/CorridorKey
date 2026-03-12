import type { ProjectDto } from "../lib/types";

type Props = {
  projects: ProjectDto[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onImport: () => void;
};

export function ProjectRail({ projects, selectedProjectId, onSelectProject, onImport }: Props) {
  return (
    <aside className="rail rail-left">
      <div className="card project-rail-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Project Library</p>
            <h2>Projects</h2>
          </div>
          <button onClick={onImport}>Import</button>
        </div>
        <p className="rail-copy">Videos can stay in place. Image sequences are normalized into each clip&apos;s managed frame folder.</p>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-card ${project.id === selectedProjectId ? "selected" : ""}`}
              onClick={() => onSelectProject(project.id)}
            >
              <strong>{project.displayName}</strong>
              <span>{project.clipCount} clips</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

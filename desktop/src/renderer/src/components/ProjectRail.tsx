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
          <h2>Projects</h2>
          <button onClick={onImport}>Import</button>
        </div>
        {projects.length === 0 ? (
          <p className="rail-copy">No projects yet. Import footage to get started.</p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-card ${project.id === selectedProjectId ? "selected" : ""}`}
                onClick={() => onSelectProject(project.id)}
              >
                <strong>{project.displayName}</strong>
                <span>
                  {project.clipCount} {project.clipCount === 1 ? "clip" : "clips"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

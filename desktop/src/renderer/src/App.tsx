import { useEffect, useMemo, useState } from "react";
import { CapabilityBanner } from "./components/CapabilityBanner";
import { ClipTable } from "./components/ClipTable";
import { ErrorDrawer } from "./components/ErrorDrawer";
import { FrameViewer } from "./components/FrameViewer";
import { ProjectRail } from "./components/ProjectRail";
import { QueuePanel } from "./components/QueuePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  cancelJob,
  connectSnapshots,
  downloadArtifact,
  fetchCapabilities,
  fetchProjects,
  importSources,
  queueClipAction,
  refreshProject
} from "./lib/api";
import type { BackendStatus, CapabilityDto, ClipDto, DownloadTaskDto, JobDto, ProjectDto, SettingsState } from "./lib/types";

const defaultSettings: SettingsState = {
  inputIsLinear: false,
  despillStrength: 0.5,
  autoDespeckle: true,
  despeckleSize: 400,
  refinerScale: 1.0
};

export function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityDto | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [downloads, setDownloads] = useState<DownloadTaskDto[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);

  useEffect(() => {
    window.corridorDesktop.getBackendStatus().then(setBackendStatus);
    const unsubscribe = window.corridorDesktop.onBackendStatus(setBackendStatus);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (backendStatus?.status !== "ready") {
      return;
    }

    fetchCapabilities().then(setCapabilities).catch((error) => setLogs((items) => [String(error), ...items].slice(0, 30)));
    fetchProjects().then(setProjects).catch((error) => setLogs((items) => [String(error), ...items].slice(0, 30)));

    let disconnect: (() => void) | undefined;
    connectSnapshots((snapshot) => {
      setJobs(snapshot.jobs);
      setProjects(snapshot.projects);
      setCapabilities(snapshot.capabilities);
      setDownloads(snapshot.downloads);
      setLogs(snapshot.logs);
    }).then((cleanup) => {
      disconnect = cleanup;
    });

    return () => disconnect?.();
  }, [backendStatus?.status]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedClip: ClipDto | null = useMemo(
    () => selectedProject?.clips.find((clip) => clip.id === selectedClipId) ?? selectedProject?.clips[0] ?? null,
    [selectedProject, selectedClipId]
  );

  async function handleImport() {
    try {
      const result = await window.corridorDesktop.pickInputs();
      if (result.canceled || !result.filePaths.length) {
        return;
      }
      await importSources(result.filePaths, true);
      const refreshed = await fetchProjects();
      setProjects(refreshed);
      if (refreshed[0]) {
        setSelectedProjectId(refreshed[0].id);
      }
    } catch (error) {
      setLogs((items) => [String(error), ...items].slice(0, 30));
    }
  }

  async function handleQueue(action: "extract" | "gvm" | "videomama" | "inference") {
    if (!selectedClip) {
      return;
    }
    try {
      await queueClipAction(selectedClip.id, action, settings);
      const projectId = selectedClip.id.split("/")[0];
      const refreshed = await refreshProject(projectId);
      setProjects((items) => items.map((project) => (project.id === refreshed.id ? refreshed : project)));
    } catch (error) {
      setLogs((items) => [String(error), ...items].slice(0, 30));
    }
  }

  async function handleDownload(artifact: "gvm") {
    try {
      const task = await downloadArtifact(artifact);
      setDownloads((items) => [...items.filter((item) => item.artifact !== artifact), task]);
    } catch (error) {
      setLogs((items) => [String(error), ...items].slice(0, 30));
    }
  }

  return (
    <div className="app-shell">
      <CapabilityBanner
        capabilities={capabilities}
        downloads={downloads}
        backendMessage={backendStatus?.message ?? null}
        onDownload={handleDownload}
      />
      <div className="workspace">
        <ProjectRail
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setSelectedClipId(null);
          }}
          onImport={handleImport}
        />
        <main className="main-column">
          <ClipTable
            clips={selectedProject?.clips ?? []}
            selectedClipId={selectedClip?.id ?? null}
            onSelectClip={setSelectedClipId}
          />
          <div className="action-row">
            <button disabled={!selectedClip || !selectedClip.availableActions.includes("extract")} onClick={() => void handleQueue("extract")}>
              Extract Frames
            </button>
            <button disabled={!selectedClip || !selectedClip.availableActions.includes("gvm")} onClick={() => void handleQueue("gvm")}>
              Run GVM
            </button>
            <button
              disabled={!selectedClip || !selectedClip.availableActions.includes("videomama")}
              onClick={() => void handleQueue("videomama")}
            >
              Run VideoMaMa
            </button>
            <button
              disabled={!selectedClip || !selectedClip.availableActions.includes("inference")}
              onClick={() => void handleQueue("inference")}
            >
              Run Inference
            </button>
            {selectedClip ? (
              <>
                <button onClick={() => void window.corridorDesktop.openPath(selectedClip.rootPath)}>Open Clip</button>
                <button onClick={() => void window.corridorDesktop.openPath(`${selectedClip.rootPath}/Output`)}>Open Output</button>
              </>
            ) : null}
          </div>
          <FrameViewer clip={selectedClip} settings={settings} />
        </main>
        <aside className="rail rail-right">
          <SettingsPanel settings={settings} onChange={setSettings} />
          <QueuePanel jobs={jobs} onCancel={(jobId) => void cancelJob(jobId)} />
          <ErrorDrawer items={logs} />
        </aside>
      </div>
    </div>
  );
}

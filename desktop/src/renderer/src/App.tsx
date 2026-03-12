import { useEffect, useMemo, useState } from "react";
import { CapabilityBanner } from "./components/CapabilityBanner";
import { ClipTable } from "./components/ClipTable";
import { ErrorDrawer } from "./components/ErrorDrawer";
import { FrameViewer } from "./components/FrameViewer";
import { ImportReviewModal } from "./components/ImportReviewModal";
import { ProjectRail } from "./components/ProjectRail";
import { QueuePanel } from "./components/QueuePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
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
import { buildImportReview, type ClipActionKind, type ImportReview } from "./lib/workflow";
import type {
  BackendLaunchConfig,
  BackendStatus,
  CapabilityDto,
  ClipDto,
  DownloadTaskDto,
  HostInfo,
  JobDto,
  ProjectDto,
  SettingsState
} from "./lib/types";

const defaultSettings: SettingsState = {
  inputIsLinear: false,
  despillStrength: 0.5,
  autoDespeckle: true,
  despeckleSize: 400,
  refinerScale: 1.0
};

export function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [backendLaunchConfig, setBackendLaunchConfig] = useState<BackendLaunchConfig | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityDto | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [downloads, setDownloads] = useState<DownloadTaskDto[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    window.corridorDesktop.getBackendStatus().then(setBackendStatus);
    window.corridorDesktop.getHostInfo().then(setHostInfo);
    window.corridorDesktop.getBackendLaunchConfig().then(setBackendLaunchConfig);
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

  useEffect(() => {
    if (!selectedProject) {
      if (selectedClipId) {
        setSelectedClipId(null);
      }
      return;
    }

    if (!selectedClipId || !selectedProject.clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(selectedProject.clips[0]?.id ?? null);
    }
  }, [selectedClipId, selectedProject]);

  async function handleImport() {
    try {
      const result = await window.corridorDesktop.pickInputs();
      if (result.canceled || !result.filePaths.length) {
        return;
      }
      setImportReview(buildImportReview(result.filePaths));
    } catch (error) {
      setLogs((items) => [String(error), ...items].slice(0, 30));
    }
  }

  async function confirmImport() {
    if (!importReview) {
      return;
    }

    setIsImporting(true);
    try {
      const response = await importSources(importReview.paths, importReview.copySource);
      const refreshed = await fetchProjects();
      setProjects(refreshed);
      setSelectedProjectId(response.project.id);
      setSelectedClipId(response.project.clips[0]?.id ?? null);
      if (response.issues.length) {
        setLogs((items) => response.issues.map((issue) => issue.message).concat(items).slice(0, 30));
      }
      setImportReview(null);
    } catch (error) {
      setLogs((items) => [String(error), ...items].slice(0, 30));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleQueue(action: ClipActionKind) {
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

  async function handleApplyBackendLaunchConfig(config: BackendLaunchConfig) {
    try {
      const nextConfig = await window.corridorDesktop.updateBackendLaunchConfig(config);
      setBackendLaunchConfig(nextConfig);
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
          <WorkflowPanel
            clip={selectedClip}
            onRunAction={(action) => void handleQueue(action)}
            onOpenClip={() => {
              if (selectedClip) {
                void window.corridorDesktop.openPath(selectedClip.rootPath);
              }
            }}
            onOpenOutput={() => {
              if (selectedClip) {
                void window.corridorDesktop.openPath(`${selectedClip.rootPath}/Output`);
              }
            }}
          />
          <ClipTable
            clips={selectedProject?.clips ?? []}
            selectedClipId={selectedClip?.id ?? null}
            onSelectClip={setSelectedClipId}
          />
          <FrameViewer clip={selectedClip} settings={settings} />
        </main>
        <aside className="rail rail-right">
          <SettingsPanel
            settings={settings}
            backendLaunchConfig={backendLaunchConfig}
            backendStatus={backendStatus}
            hostInfo={hostInfo}
            onApplyBackendLaunchConfig={handleApplyBackendLaunchConfig}
            onChange={setSettings}
          />
          <QueuePanel jobs={jobs} onCancel={(jobId) => void cancelJob(jobId)} />
          <ErrorDrawer items={logs} />
        </aside>
      </div>
      <ImportReviewModal
        draft={importReview}
        busy={isImporting}
        onClose={() => setImportReview(null)}
        onToggleCopySource={(copySource) =>
          setImportReview((current) =>
            current
              ? {
                  ...current,
                  copySource
                }
              : current
          )
        }
        onConfirm={() => void confirmImport()}
      />
    </div>
  );
}

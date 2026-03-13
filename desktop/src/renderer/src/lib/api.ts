import type { DownloadTaskDto, ImportResponse, SettingsState, SnapshotDto } from "./types";

function serializeSettings(settings?: SettingsState) {
  if (!settings) {
    return undefined;
  }

  return {
    input_is_linear: settings.inputIsLinear,
    despill_strength: settings.despillStrength,
    auto_despeckle: settings.autoDespeckle,
    despeckle_size: settings.despeckleSize,
    refiner_scale: settings.refinerScale,
    img_size: settings.imgSize === "auto" ? null : settings.imgSize
  };
}

async function authedFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const backend = await window.corridorDesktop.getBackendStatus();
  if (!backend.url || !backend.authToken) {
    throw new Error("Backend is not ready.");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${backend.authToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${backend.url}${pathname}`, {
    ...init,
    headers
  });
}

export async function fetchCapabilities() {
  const response = await authedFetch("/capabilities");
  if (!response.ok) {
    throw new Error("Failed to load capabilities");
  }
  return response.json();
}

export async function fetchProjects() {
  const response = await authedFetch("/projects");
  if (!response.ok) {
    throw new Error("Failed to load projects");
  }
  return response.json();
}

export async function importSources(paths: string[], copySource = true): Promise<ImportResponse> {
  const response = await authedFetch("/projects/import", {
    method: "POST",
    body: JSON.stringify({ paths, copySource })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Import failed");
  }
  return response.json();
}

export async function refreshProject(projectId: string) {
  const response = await authedFetch(`/projects/${projectId}/scan`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("Failed to refresh project");
  }
  return response.json();
}

export async function queueClipAction(
  clipId: string,
  action: "extract" | "gvm" | "rvm" | "videomama" | "inference",
  settings?: SettingsState
) {
  const response = await authedFetch(`/clips/${clipId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ settings: serializeSettings(settings) })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to queue ${action}`);
  }
  return response.json();
}

export async function cancelJob(jobId: string) {
  const response = await authedFetch(`/jobs/${jobId}/cancel`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("Failed to cancel job");
  }
}

export async function downloadArtifact(artifact: "gvm" | "rvm"): Promise<DownloadTaskDto> {
  const response = await authedFetch(`/downloads/${artifact}`, {
    method: "POST"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to start ${artifact} download`);
  }
  return response.json();
}

export async function previewFrame(clipId: string, frameIndex: number, settings: SettingsState) {
  const response = await authedFetch(`/clips/${clipId}/preview-frame`, {
    method: "POST",
    body: JSON.stringify({
      frameIndex,
      settings: serializeSettings(settings)
    })
  });
  if (!response.ok) {
    throw new Error("Failed to preview frame");
  }
  return response.json();
}

export async function frameUrl(clipId: string, view: string, frameIndex: number) {
  const backend = await window.corridorDesktop.getBackendStatus();
  if (!backend.url || !backend.authToken) {
    return null;
  }
  const url = new URL(`${backend.url}/clips/${clipId}/frame`);
  url.searchParams.set("view", view);
  url.searchParams.set("frameIndex", String(frameIndex));
  url.searchParams.set("authToken", backend.authToken);
  return url.toString();
}

export async function connectSnapshots(onSnapshot: (snapshot: SnapshotDto) => void) {
  const backend = await window.corridorDesktop.getBackendStatus();
  if (!backend.url || !backend.authToken) {
    return () => undefined;
  }

  const streamUrl = new URL(`${backend.url}/events`);
  streamUrl.searchParams.set("authToken", backend.authToken);
  const source = new EventSource(streamUrl);
  source.onmessage = (event) => {
    onSnapshot(JSON.parse(event.data));
  };
  return () => source.close();
}

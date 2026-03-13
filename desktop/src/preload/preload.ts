import { contextBridge, ipcRenderer } from "electron";

export type BackendStatus = {
  status: "starting" | "ready" | "error" | "stopped";
  url: string | null;
  authToken: string | null;
  message: string | null;
};

export type BackendLaunchConfig = {
  backendMode: "torch" | "mlx";
  enableMpsFastMath: boolean;
  enableMpsPreferMetal: boolean;
  mpsHighWatermarkRatio: string;
};

export type HostInfo = {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  isAppleSiliconMac: boolean;
};

export type OpenDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

const api = {
  pickInputs: (): Promise<OpenDialogResult> => ipcRenderer.invoke("dialog:pick-inputs"),
  getBackendStatus: (): Promise<BackendStatus> => ipcRenderer.invoke("backend:get-status"),
  getBackendLaunchConfig: (): Promise<BackendLaunchConfig> => ipcRenderer.invoke("backend:get-launch-config"),
  updateBackendLaunchConfig: (config: BackendLaunchConfig): Promise<BackendLaunchConfig> =>
    ipcRenderer.invoke("backend:update-launch-config", config),
  openPath: (targetPath: string): Promise<string> => ipcRenderer.invoke("shell:open-path", targetPath),
  getRepoRoot: (): Promise<string> => ipcRenderer.invoke("app:get-root"),
  getHostInfo: (): Promise<HostInfo> => ipcRenderer.invoke("app:get-host-info"),
  onBackendStatus: (callback: (status: BackendStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: BackendStatus) => callback(status);
    ipcRenderer.on("backend-status", listener);
    return () => ipcRenderer.removeListener("backend-status", listener);
  }
};

contextBridge.exposeInMainWorld("corridorDesktop", api);

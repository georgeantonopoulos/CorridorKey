import { contextBridge, ipcRenderer } from "electron";

export type BackendStatus = {
  status: "starting" | "ready" | "error" | "stopped";
  url: string | null;
  authToken: string | null;
  message: string | null;
};

export type OpenDialogResult = {
  canceled: boolean;
  filePaths: string[];
};

const api = {
  pickInputs: (): Promise<OpenDialogResult> => ipcRenderer.invoke("dialog:pick-inputs"),
  getBackendStatus: (): Promise<BackendStatus> => ipcRenderer.invoke("backend:get-status"),
  openPath: (targetPath: string): Promise<string> => ipcRenderer.invoke("shell:open-path", targetPath),
  getRepoRoot: (): Promise<string> => ipcRenderer.invoke("app:get-root"),
  onBackendStatus: (callback: (status: BackendStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: BackendStatus) => callback(status);
    ipcRenderer.on("backend-status", listener);
    return () => ipcRenderer.removeListener("backend-status", listener);
  }
};

contextBridge.exposeInMainWorld("corridorDesktop", api);

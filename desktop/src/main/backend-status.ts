type BackendStatus = {
  status: "starting" | "ready" | "error" | "stopped";
  url: string | null;
  authToken: string | null;
  message: string | null;
};

type WindowLike = {
  isDestroyed?: () => boolean;
  webContents?: {
    isDestroyed?: () => boolean;
    send: (channel: string, status: BackendStatus) => void;
  };
};

export function sendBackendStatus(windowRef: WindowLike | null, status: BackendStatus): void {
  if (!windowRef) {
    return;
  }
  if (typeof windowRef.isDestroyed === "function" && windowRef.isDestroyed()) {
    return;
  }
  const contents = windowRef.webContents;
  if (!contents) {
    return;
  }
  if (typeof contents.isDestroyed === "function" && contents.isDestroyed()) {
    return;
  }
  contents.send("backend-status", status);
}

export type { BackendStatus };

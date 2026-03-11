import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";

type BackendStatus = {
  status: "starting" | "ready" | "error" | "stopped";
  url: string | null;
  authToken: string | null;
  message: string | null;
};

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let backendProc: ChildProcessWithoutNullStreams | null = null;
let backendStatus: BackendStatus = {
  status: "starting",
  url: null,
  authToken: null,
  message: null
};

const repoRoot = path.resolve(__dirname, "../../..");
const preferredPython = path.join(repoRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

function buildBackendEnv(port: number, token: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CORRIDORKEY_GUI_API_HOST: "127.0.0.1",
    CORRIDORKEY_GUI_API_PORT: String(port),
    CORRIDORKEY_GUI_API_TOKEN: token,
    PYTHONUNBUFFERED: "1"
  };
}

async function probeBackend(url: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackend(): Promise<void> {
  const port = 8765;
  const token = randomUUID();
  const url = `http://127.0.0.1:${port}`;
  const env = buildBackendEnv(port, token);
  const pythonCommand = fs.existsSync(preferredPython) ? preferredPython : "python3";

  backendStatus = {
    status: "starting",
    url,
    authToken: token,
    message: "Starting Python GUI API..."
  };

  backendProc = spawn(pythonCommand, ["-m", "backend.gui_api"], {
    cwd: repoRoot,
    env,
    stdio: "pipe"
  });

  backendProc.stdout.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      backendStatus = { ...backendStatus, message };
      mainWindow?.webContents.send("backend-status", backendStatus);
    }
  });

  backendProc.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      backendStatus = { ...backendStatus, message };
      mainWindow?.webContents.send("backend-status", backendStatus);
    }
  });

  backendProc.on("exit", (code) => {
    backendStatus = {
      ...backendStatus,
      status: "stopped",
      message: code === 0 ? "Backend stopped." : `Backend exited with code ${code ?? "unknown"}.`
    };
    mainWindow?.webContents.send("backend-status", backendStatus);
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await probeBackend(url, token)) {
      backendStatus = {
        ...backendStatus,
        status: "ready",
        message: "Backend ready."
      };
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  backendStatus = {
    ...backendStatus,
    status: "error",
    message: "Python GUI API did not become ready in time."
  };
}

function stopBackend(): void {
  if (!backendProc) {
    return;
  }
  backendProc.kill();
  backendProc = null;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0c1217",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("backend-status", backendStatus);
  });
}

ipcMain.handle("dialog:pick-inputs", async () => {
  const response = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "openDirectory", "multiSelections"],
    filters: [
      {
        name: "Media",
        extensions: ["mp4", "mov", "avi", "mkv", "mxf", "webm", "m4v", "png", "jpg", "jpeg", "exr", "tif", "tiff", "bmp", "dpx"]
      }
    ]
  });
  return response;
});

ipcMain.handle("backend:get-status", async () => backendStatus);
ipcMain.handle("shell:open-path", async (_event, targetPath: string) => shell.openPath(targetPath));
ipcMain.handle("app:get-root", async () => repoRoot);

app.whenReady().then(async () => {
  await startBackend();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopBackend();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

import { randomUUID } from "node:crypto";
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createConnection } from "node:net";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  buildBackendEnv,
  defaultBackendLaunchConfig,
  getBackendHostInfo,
  type BackendHostInfo,
  type BackendLaunchConfig
} from "./backend-env";
import { sendBackendStatus, type BackendStatus } from "./backend-status";

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
const hostInfo: BackendHostInfo = getBackendHostInfo();
let backendLaunchConfig: BackendLaunchConfig = defaultBackendLaunchConfig();

/**
 * Check if a port is already in use by attempting a TCP connection.
 * Returns the PID and command of the occupying process when possible.
 */
function checkPortOccupied(port: number): Promise<{ occupied: boolean; pid?: number; command?: string }> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(500);

    socket.on("connect", () => {
      socket.destroy();

      // Port is occupied — try to identify the process (macOS/Linux)
      try {
        const output = execFileSync("lsof", ["-ti", `:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", timeout: 2000 }).trim();
        const pid = parseInt(output.split("\n")[0], 10);
        if (!isNaN(pid)) {
          const cmdOutput = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 2000 }).trim();
          resolve({ occupied: true, pid, command: cmdOutput });
          return;
        }
      } catch {
        // lsof/ps not available or failed — still occupied
      }
      resolve({ occupied: true });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ occupied: false });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ occupied: false });
    });
  });
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
  const env = buildBackendEnv(port, token, { launchConfig: backendLaunchConfig });
  const pythonCommand = fs.existsSync(preferredPython) ? preferredPython : "python3";

  backendStatus = {
    status: "starting",
    url,
    authToken: token,
    message: "Starting Python GUI API..."
  };

  // Fail fast if another process already occupies our port
  const portCheck = await checkPortOccupied(port);
  if (portCheck.occupied) {
    const who = portCheck.pid
      ? `PID ${portCheck.pid} (${portCheck.command ?? "unknown"})`
      : "an unknown process";
    backendStatus = {
      ...backendStatus,
      status: "error",
      message: `Port ${port} is already in use by ${who}. Kill it or restart the app.`
    };
    return;
  }

  backendProc = spawn(pythonCommand, ["-m", "backend.gui_api"], {
    cwd: repoRoot,
    env,
    stdio: "pipe"
  });

  backendProc.stdout.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      backendStatus = { ...backendStatus, message };
      sendBackendStatus(mainWindow, backendStatus);
    }
  });

  backendProc.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      backendStatus = { ...backendStatus, message };
      sendBackendStatus(mainWindow, backendStatus);
    }
  });

  backendProc.on("exit", (code) => {
    backendStatus = {
      ...backendStatus,
      status: "stopped",
      message: code === 0 ? "Backend stopped." : `Backend exited with code ${code ?? "unknown"}.`
    };
    sendBackendStatus(mainWindow, backendStatus);
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

async function stopBackend(): Promise<void> {
  if (!backendProc) {
    return;
  }

  const proc = backendProc;
  backendProc = null;

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    proc.once("exit", finish);
    proc.kill();
    setTimeout(finish, 1500);
  });
}

async function restartBackend(): Promise<BackendStatus> {
  backendStatus = {
    ...backendStatus,
    status: "starting",
    message: "Restarting Python GUI API..."
  };
  sendBackendStatus(mainWindow, backendStatus);
  await stopBackend();
  await startBackend();
  sendBackendStatus(mainWindow, backendStatus);
  return backendStatus;
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
    sendBackendStatus(mainWindow, backendStatus);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
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
ipcMain.handle("backend:get-launch-config", async () => backendLaunchConfig);
ipcMain.handle("backend:update-launch-config", async (_event, nextConfig: BackendLaunchConfig) => {
  backendLaunchConfig = {
    ...backendLaunchConfig,
    ...nextConfig
  };
  await restartBackend();
  return backendLaunchConfig;
});
ipcMain.handle("shell:open-path", async (_event, targetPath: string) => shell.openPath(targetPath));
ipcMain.handle("app:get-root", async () => repoRoot);
ipcMain.handle("app:get-host-info", async () => hostInfo);

app.whenReady().then(async () => {
  await startBackend();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void stopBackend();
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopBackend();
});

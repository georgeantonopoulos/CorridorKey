/// <reference types="vite/client" />

import type { BackendLaunchConfig, BackendStatus, HostInfo, OpenDialogResult } from "../../preload/preload";

declare global {
  interface Window {
    corridorDesktop: {
      pickInputs: () => Promise<OpenDialogResult>;
      getBackendStatus: () => Promise<BackendStatus>;
      getBackendLaunchConfig: () => Promise<BackendLaunchConfig>;
      updateBackendLaunchConfig: (config: BackendLaunchConfig) => Promise<BackendLaunchConfig>;
      openPath: (targetPath: string) => Promise<string>;
      getRepoRoot: () => Promise<string>;
      getHostInfo: () => Promise<HostInfo>;
      onBackendStatus: (callback: (status: BackendStatus) => void) => () => void;
    };
  }
}

export {};

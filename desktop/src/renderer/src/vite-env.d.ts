/// <reference types="vite/client" />

import type { BackendStatus, OpenDialogResult } from "../../preload/preload";

declare global {
  interface Window {
    corridorDesktop: {
      pickInputs: () => Promise<OpenDialogResult>;
      getBackendStatus: () => Promise<BackendStatus>;
      openPath: (targetPath: string) => Promise<string>;
      getRepoRoot: () => Promise<string>;
      onBackendStatus: (callback: (status: BackendStatus) => void) => () => void;
    };
  }
}

export {};

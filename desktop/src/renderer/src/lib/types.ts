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

export type CapabilityDto = {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  torchCheckpointReady: boolean;
  mlxCheckpointReady: boolean;
  gvmAvailable: boolean;
  gvmWeightsReady: boolean;
  rvmAvailable: boolean;
  rvmWeightsReady: boolean;
  videomamaAvailable: boolean;
  detectedDevice: string;
  detectedBackend: string;
  warnings: string[];
};

export type ValidationIssueDto = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string | null;
};

export type ClipDto = {
  id: string;
  name: string;
  state: string;
  rootPath: string;
  inputType: string | null;
  frameCount: number;
  alphaFrameCount: number;
  validationIssues: ValidationIssueDto[];
  currentJobId: string | null;
  lastJobId: string | null;
  availableActions: string[];
  hasOutputs: boolean;
};

export type ProjectDto = {
  id: string;
  displayName: string;
  rootPath: string;
  clipCount: number;
  clips: ClipDto[];
};

export type JobDto = {
  id: string;
  clipId: string | null;
  clipName: string;
  jobType: string;
  status: string;
  currentFrame: number;
  totalFrames: number;
  phaseLabel: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  warningCount: number;
  errorMessage: string | null;
};

export type DownloadTaskDto = {
  artifact: string;
  status: string;
  completedSteps: number;
  totalSteps: number;
  completedBytes: number;
  totalBytes: number;
  currentFile: string | null;
  currentFileBytes: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type SettingsState = {
  inputIsLinear: boolean;
  despillStrength: number;
  autoDespeckle: boolean;
  despeckleSize: number;
  refinerScale: number;
  imgSize: "auto" | 1024 | 1536 | 2048;
};

export type SnapshotDto = {
  projects: ProjectDto[];
  jobs: JobDto[];
  capabilities: CapabilityDto;
  downloads: DownloadTaskDto[];
  logs: string[];
};

export type ImportResponse = {
  project: ProjectDto;
  issues: ValidationIssueDto[];
};

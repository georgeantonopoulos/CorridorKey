export type AppleSiliconBackendMode = "torch" | "mlx";

export type BackendLaunchConfig = {
  backendMode: AppleSiliconBackendMode;
  enableMpsFastMath: boolean;
  enableMpsPreferMetal: boolean;
  mpsHighWatermarkRatio: string;
};

export type BackendHostInfo = {
  arch: NodeJS.Architecture;
  isAppleSiliconMac: boolean;
  platform: NodeJS.Platform;
};

type BackendEnvOptions = {
  arch?: NodeJS.Architecture;
  baseEnv?: NodeJS.ProcessEnv;
  launchConfig?: BackendLaunchConfig;
  platform?: NodeJS.Platform;
};

export function isAppleSiliconMac(platform = process.platform, arch = process.arch as NodeJS.Architecture): boolean {
  return platform === "darwin" && arch === "arm64";
}

export function getBackendHostInfo(
  platform = process.platform,
  arch = process.arch as NodeJS.Architecture
): BackendHostInfo {
  return {
    platform,
    arch,
    isAppleSiliconMac: isAppleSiliconMac(platform, arch)
  };
}

export function defaultBackendLaunchConfig(
  baseEnv: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
  arch = process.arch as NodeJS.Architecture
): BackendLaunchConfig {
  if (!isAppleSiliconMac(platform, arch)) {
    return {
      backendMode: "torch",
      enableMpsFastMath: false,
      enableMpsPreferMetal: false,
      mpsHighWatermarkRatio: ""
    };
  }

  return {
    backendMode: baseEnv.CORRIDORKEY_BACKEND === "mlx" ? "mlx" : "torch",
    enableMpsFastMath: baseEnv.CORRIDORKEY_ENABLE_MPS_FAST_MATH !== "0",
    enableMpsPreferMetal: baseEnv.CORRIDORKEY_ENABLE_MPS_PREFER_METAL !== "0",
    mpsHighWatermarkRatio: baseEnv.CORRIDORKEY_MPS_HIGH_WATERMARK_RATIO ?? "0.0"
  };
}

export function buildBackendEnv(port: number, token: string, options: BackendEnvOptions = {}): NodeJS.ProcessEnv {
  const baseEnv = { ...(options.baseEnv ?? process.env) };
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const launchConfig = options.launchConfig ?? defaultBackendLaunchConfig(baseEnv, platform, arch);

  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    CORRIDORKEY_GUI_API_HOST: "127.0.0.1",
    CORRIDORKEY_GUI_API_PORT: String(port),
    CORRIDORKEY_GUI_API_TOKEN: token,
    PYTHONUNBUFFERED: "1"
  };

  if (!isAppleSiliconMac(platform, arch)) {
    delete env.PYTORCH_MPS_FAST_MATH;
    delete env.PYTORCH_MPS_PREFER_METAL;
    delete env.PYTORCH_MPS_HIGH_WATERMARK_RATIO;
    return env;
  }

  env.CORRIDORKEY_BACKEND = launchConfig.backendMode;

  if (launchConfig.backendMode === "torch" && launchConfig.enableMpsFastMath) {
    env.PYTORCH_MPS_FAST_MATH = "1";
  } else {
    delete env.PYTORCH_MPS_FAST_MATH;
  }

  if (launchConfig.backendMode === "torch" && launchConfig.enableMpsPreferMetal) {
    env.PYTORCH_MPS_PREFER_METAL = "1";
  } else {
    delete env.PYTORCH_MPS_PREFER_METAL;
  }

  if (launchConfig.backendMode === "torch" && launchConfig.mpsHighWatermarkRatio.trim()) {
    env.PYTORCH_MPS_HIGH_WATERMARK_RATIO = launchConfig.mpsHighWatermarkRatio.trim();
  } else {
    delete env.PYTORCH_MPS_HIGH_WATERMARK_RATIO;
  }

  return env;
}

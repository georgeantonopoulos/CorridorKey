type BackendEnvOptions = {
  arch?: NodeJS.Architecture;
  baseEnv?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
};

export function isAppleSiliconMac(platform = process.platform, arch = process.arch as NodeJS.Architecture): boolean {
  return platform === "darwin" && arch === "arm64";
}

export function buildBackendEnv(port: number, token: string, options: BackendEnvOptions = {}): NodeJS.ProcessEnv {
  const baseEnv = { ...(options.baseEnv ?? process.env) };
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;

  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    CORRIDORKEY_GUI_API_HOST: "127.0.0.1",
    CORRIDORKEY_GUI_API_PORT: String(port),
    CORRIDORKEY_GUI_API_TOKEN: token,
    PYTHONUNBUFFERED: "1"
  };

  if (!isAppleSiliconMac(platform, arch)) {
    return env;
  }

  const enableFastMath = baseEnv.CORRIDORKEY_ENABLE_MPS_FAST_MATH ?? "1";
  const enablePreferMetal = baseEnv.CORRIDORKEY_ENABLE_MPS_PREFER_METAL ?? "1";

  if (enableFastMath !== "0" && env.PYTORCH_MPS_FAST_MATH == null) {
    env.PYTORCH_MPS_FAST_MATH = "1";
  }

  if (enablePreferMetal !== "0" && env.PYTORCH_MPS_PREFER_METAL == null) {
    env.PYTORCH_MPS_PREFER_METAL = "1";
  }

  if (baseEnv.CORRIDORKEY_MPS_HIGH_WATERMARK_RATIO && env.PYTORCH_MPS_HIGH_WATERMARK_RATIO == null) {
    env.PYTORCH_MPS_HIGH_WATERMARK_RATIO = baseEnv.CORRIDORKEY_MPS_HIGH_WATERMARK_RATIO;
  }

  return env;
}

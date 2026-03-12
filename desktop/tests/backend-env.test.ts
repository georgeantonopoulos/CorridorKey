import { describe, expect, it } from "vitest";

import { buildBackendEnv, defaultBackendLaunchConfig, isAppleSiliconMac } from "../src/main/backend-env";

describe("backend-env", () => {
  it("enables MPS tuning defaults on Apple Silicon Macs", () => {
    const env = buildBackendEnv(8765, "token", {
      baseEnv: {},
      platform: "darwin",
      arch: "arm64"
    });

    expect(isAppleSiliconMac("darwin", "arm64")).toBe(true);
    expect(env.PYTORCH_MPS_FAST_MATH).toBe("1");
    expect(env.PYTORCH_MPS_PREFER_METAL).toBe("1");
  });

  it("does not inject MPS tuning on non-Mac platforms", () => {
    const env = buildBackendEnv(8765, "token", {
      baseEnv: {},
      platform: "linux",
      arch: "x64"
    });

    expect(isAppleSiliconMac("linux", "x64")).toBe(false);
    expect(env.PYTORCH_MPS_FAST_MATH).toBeUndefined();
    expect(env.PYTORCH_MPS_PREFER_METAL).toBeUndefined();
  });

  it("lets A/B tests disable the MPS tuning flags explicitly", () => {
    const launchConfig = defaultBackendLaunchConfig(
      {
        CORRIDORKEY_ENABLE_MPS_FAST_MATH: "0",
        CORRIDORKEY_ENABLE_MPS_PREFER_METAL: "0"
      },
      "darwin",
      "arm64"
    );
    const env = buildBackendEnv(8765, "token", {
      baseEnv: {},
      launchConfig,
      platform: "darwin",
      arch: "arm64"
    });

    expect(env.PYTORCH_MPS_FAST_MATH).toBeUndefined();
    expect(env.PYTORCH_MPS_PREFER_METAL).toBeUndefined();
  });

  it("defaults PYTORCH_MPS_HIGH_WATERMARK_RATIO to 0.0 on Apple Silicon", () => {
    const env = buildBackendEnv(8765, "token", {
      baseEnv: {},
      platform: "darwin",
      arch: "arm64"
    });

    expect(env.PYTORCH_MPS_HIGH_WATERMARK_RATIO).toBe("0.0");
  });

  it("allows overriding PYTORCH_MPS_HIGH_WATERMARK_RATIO via env var", () => {
    const env = buildBackendEnv(8765, "token", {
      baseEnv: { CORRIDORKEY_MPS_HIGH_WATERMARK_RATIO: "0.7" },
      platform: "darwin",
      arch: "arm64"
    });

    expect(env.PYTORCH_MPS_HIGH_WATERMARK_RATIO).toBe("0.7");
  });
});

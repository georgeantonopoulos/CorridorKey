import { describe, expect, it } from "vitest";

import { buildBackendEnv, isAppleSiliconMac } from "../src/main/backend-env";

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
    const env = buildBackendEnv(8765, "token", {
      baseEnv: {
        CORRIDORKEY_ENABLE_MPS_FAST_MATH: "0",
        CORRIDORKEY_ENABLE_MPS_PREFER_METAL: "0"
      },
      platform: "darwin",
      arch: "arm64"
    });

    expect(env.PYTORCH_MPS_FAST_MATH).toBeUndefined();
    expect(env.PYTORCH_MPS_PREFER_METAL).toBeUndefined();
  });
});

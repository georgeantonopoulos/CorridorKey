import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "../src/renderer/src/components/SettingsPanel";

describe("SettingsPanel", () => {
  it("lets Apple Silicon users switch between Torch + MPS and MLX", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPanel
        settings={{
          inputIsLinear: false,
          despillStrength: 0.5,
          autoDespeckle: true,
          despeckleSize: 400,
          refinerScale: 1,
          imgSize: "auto"
        }}
        backendLaunchConfig={{
          backendMode: "torch",
          enableMpsFastMath: true,
          enableMpsPreferMetal: true,
          mpsHighWatermarkRatio: ""
        }}
        backendStatus={{
          status: "ready",
          url: "http://127.0.0.1:8765",
          authToken: "token",
          message: null
        }}
        hostInfo={{
          platform: "darwin",
          arch: "arm64",
          isAppleSiliconMac: true
        }}
        onApplyBackendLaunchConfig={onApply}
        onChange={() => undefined}
      />
    );

    fireEvent.click(screen.getByText("Apple Silicon backend"));

    expect(screen.getByLabelText("Backend engine")).toHaveValue("torch");
    expect(screen.getByText("Fast math")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Backend engine"), { target: { value: "mlx" } });

    expect(screen.getByText("MLX bypasses the PyTorch MPS allocator, so the MPS tuning controls are hidden while MLX is selected.")).toBeInTheDocument();
    expect(screen.queryByText("Fast math")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Apply & restart backend/i }));
    expect(onApply).toHaveBeenCalledWith({
      backendMode: "mlx",
      enableMpsFastMath: true,
      enableMpsPreferMetal: true,
      mpsHighWatermarkRatio: ""
    });
  });

  it("hides Apple Silicon backend controls on non-Apple Silicon hosts", () => {
    render(
      <SettingsPanel
        settings={{
          inputIsLinear: false,
          despillStrength: 0.5,
          autoDespeckle: true,
          despeckleSize: 400,
          refinerScale: 1,
          imgSize: "auto"
        }}
        backendLaunchConfig={{
          backendMode: "torch",
          enableMpsFastMath: true,
          enableMpsPreferMetal: true,
          mpsHighWatermarkRatio: ""
        }}
        backendStatus={{
          status: "ready",
          url: "http://127.0.0.1:8765",
          authToken: "token",
          message: null
        }}
        hostInfo={{
          platform: "linux",
          arch: "x64",
          isAppleSiliconMac: false
        }}
        onApplyBackendLaunchConfig={vi.fn().mockResolvedValue(undefined)}
        onChange={() => undefined}
      />
    );

    expect(screen.queryByText("Apple Silicon backend")).not.toBeInTheDocument();
  });
});

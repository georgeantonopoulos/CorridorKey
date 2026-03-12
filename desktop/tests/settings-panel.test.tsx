import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "../src/renderer/src/components/SettingsPanel";

describe("SettingsPanel", () => {
  it("shows Apple Silicon backend toggles only on Apple Silicon Macs", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPanel
        settings={{
          inputIsLinear: false,
          despillStrength: 0.5,
          autoDespeckle: true,
          despeckleSize: 400,
          refinerScale: 1
        }}
        backendLaunchConfig={{
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

    expect(screen.getByText("Apple Silicon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Enable fast math/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply & Restart Backend" }));
    expect(onApply).toHaveBeenCalled();
  });
});

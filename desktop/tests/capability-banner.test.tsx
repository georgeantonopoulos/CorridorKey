import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CapabilityBanner } from "../src/renderer/src/components/CapabilityBanner";

describe("CapabilityBanner", () => {
  it("offers a GVM download action when weights are missing", () => {
    const onDownload = vi.fn();

    render(
      <CapabilityBanner
        capabilities={{
          ffmpegAvailable: true,
          ffprobeAvailable: true,
          torchCheckpointReady: true,
          mlxCheckpointReady: false,
          gvmAvailable: false,
          gvmWeightsReady: false,
          videomamaAvailable: false,
          detectedDevice: "mps",
          detectedBackend: "mlx",
          warnings: ["GVM weights are missing."]
        }}
        downloads={[]}
        backendMessage={null}
        onDownload={onDownload}
      />
    );

    expect(screen.getByText(/GVM download size: about 6.48 GB\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download GVM Weights" }));
    expect(onDownload).toHaveBeenCalledWith("gvm");
  });

  it("shows download progress and current file size while GVM weights are downloading", () => {
    render(
      <CapabilityBanner
        capabilities={{
          ffmpegAvailable: true,
          ffprobeAvailable: true,
          torchCheckpointReady: true,
          mlxCheckpointReady: false,
          gvmAvailable: false,
          gvmWeightsReady: false,
          videomamaAvailable: false,
          detectedDevice: "mps",
          detectedBackend: "mlx",
          warnings: ["GVM weights are missing."]
        }}
        downloads={[
          {
            artifact: "gvm",
            status: "running",
            completedSteps: 2,
            totalSteps: 7,
            completedBytes: 1334,
            totalBytes: 6481893830,
            currentFile: "unet/diffusion_pytorch_model.safetensors",
            currentFileBytes: 6088185968,
            message: "Downloading GVM file 3/7",
            startedAt: null,
            finishedAt: null,
            errorMessage: null
          }
        ]}
        backendMessage={null}
        onDownload={() => undefined}
      />
    );

    expect(screen.getByText(/Progress:/)).toBeInTheDocument();
    expect(screen.getByText(/Current file: unet\/diffusion_pytorch_model\.safetensors/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downloading GVM (2/7)" })).toBeDisabled();
  });
});

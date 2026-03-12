import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueuePanel } from "../src/renderer/src/components/QueuePanel";

describe("QueuePanel", () => {
  it("invokes the cancel callback for running jobs", () => {
    const onCancel = vi.fn();

    render(
      <QueuePanel
        jobs={[
          {
            id: "job-1",
            clipId: "project/clip",
            clipName: "clip",
            jobType: "gvm_alpha",
            status: "running",
            currentFrame: 12,
            totalFrames: 100,
            phaseLabel: "GVM progress: 12/100 frames, 0.20 fps, ETA 7m 20s",
            startedAt: null,
            finishedAt: null,
            warningCount: 0,
            errorMessage: null
          }
        ]}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith("job-1");
  });
});

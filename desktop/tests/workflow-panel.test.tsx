import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowPanel } from "../src/renderer/src/components/WorkflowPanel";

describe("WorkflowPanel", () => {
  it("lets the user choose which alpha generator to run", () => {
    const onRunAction = vi.fn();
    const onSelectAlphaGenerator = vi.fn();

    render(
      <WorkflowPanel
        clip={{
          id: "project/clip",
          name: "clip",
          state: "RAW",
          rootPath: "/tmp/project/clip",
          inputType: "sequence",
          frameCount: 120,
          alphaFrameCount: 0,
          validationIssues: [],
          currentJobId: null,
          lastJobId: null,
          availableActions: ["rvm", "gvm"],
          hasOutputs: false
        }}
        onRunAction={onRunAction}
        selectedAlphaGenerator="gvm"
        onSelectAlphaGenerator={onSelectAlphaGenerator}
        onOpenClip={() => undefined}
        onOpenOutput={() => undefined}
      />
    );

    expect(screen.getByLabelText(/Alpha model/)).toHaveValue("gvm");
    fireEvent.click(screen.getByRole("button", { name: "Generate alpha with GVM" }));
    expect(onRunAction).toHaveBeenCalledWith("gvm");

    fireEvent.change(screen.getByLabelText(/Alpha model/), { target: { value: "rvm" } });
    expect(onSelectAlphaGenerator).toHaveBeenCalledWith("rvm");
  });

  it("keeps CorridorKey visible but disabled until an alpha hint is present", () => {
    render(
      <WorkflowPanel
        clip={{
          id: "project/clip",
          name: "clip",
          state: "RAW",
          rootPath: "/tmp/project/clip",
          inputType: "sequence",
          frameCount: 120,
          alphaFrameCount: 0,
          validationIssues: [],
          currentJobId: null,
          lastJobId: null,
          availableActions: ["rvm", "gvm"],
          hasOutputs: false
        }}
        onRunAction={() => undefined}
        selectedAlphaGenerator="rvm"
        onSelectAlphaGenerator={() => undefined}
        onOpenClip={() => undefined}
        onOpenOutput={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Run CorridorKey" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate alpha with RVM" })).toBeEnabled();
  });
});

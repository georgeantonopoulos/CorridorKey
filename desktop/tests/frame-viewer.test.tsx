import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FrameViewer } from "../src/renderer/src/components/FrameViewer";

describe("FrameViewer", () => {
  it("shows a placeholder when no clip is selected", () => {
    render(
      <FrameViewer
        clip={null}
        settings={{
          inputIsLinear: false,
          despillStrength: 0.5,
          autoDespeckle: true,
          despeckleSize: 400,
          refinerScale: 1.0
        }}
      />
    );

    expect(screen.getByText("Select a clip to inspect frames.")).toBeInTheDocument();
  });
});

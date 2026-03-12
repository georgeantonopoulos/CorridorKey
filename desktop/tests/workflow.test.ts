import { describe, expect, it } from "vitest";

import { buildImportReview, describeImportSource, summarizeWorkflow } from "../src/renderer/src/lib/workflow";

describe("workflow helpers", () => {
  it("prefers GVM when a raw clip is ready for alpha generation", () => {
    const summary = summarizeWorkflow({
      id: "project/clip",
      name: "clip",
      state: "RAW",
      rootPath: "/tmp/project/clip",
      inputType: "sequence",
      frameCount: 120,
      alphaFrameCount: 0,
      validationIssues: [
        {
          severity: "warning",
          code: "missing_alpha",
          message: "Alpha hint is missing."
        }
      ],
      currentJobId: null,
      lastJobId: null,
      availableActions: ["gvm"],
      hasOutputs: false
    });

    expect(summary.primaryAction?.action).toBe("gvm");
    expect(summary.headline).toContain("Generate");
  });

  it("defaults video imports to in-place reference mode", () => {
    const review = buildImportReview(["/shots/plate.mov", "/shots/greenscreen.mxf"]);

    expect(review.videoCount).toBe(2);
    expect(review.managedCount).toBe(0);
    expect(review.copySource).toBe(false);
  });

  it("flags folders as managed sequence imports", () => {
    const review = buildImportReview(["/shots/PlateSequence"]);

    expect(review.managedCount).toBe(1);
    expect(describeImportSource(review.sourceKinds[0])).toBe("Folder / sequence");
  });
});

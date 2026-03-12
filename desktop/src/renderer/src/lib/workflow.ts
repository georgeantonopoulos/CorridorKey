import type { ClipDto, ValidationIssueDto } from "./types";

export type ClipActionKind = "extract" | "gvm" | "videomama" | "inference";

export type WorkflowAction = {
  action: ClipActionKind;
  label: string;
};

export type WorkflowSummary = {
  stageLabel: string;
  headline: string;
  description: string;
  primaryAction: WorkflowAction | null;
  secondaryActions: WorkflowAction[];
  issues: ValidationIssueDto[];
};

export type ImportSourceKind = "video" | "image" | "folder" | "unknown";

export type ImportReview = {
  paths: string[];
  sourceKinds: ImportSourceKind[];
  videoCount: number;
  managedCount: number;
  copySource: boolean;
};

const videoExtensions = new Set(["mp4", "mov", "avi", "mkv", "mxf", "webm", "m4v"]);
const imageExtensions = new Set(["png", "jpg", "jpeg", "exr", "tif", "tiff", "bmp", "dpx"]);

const actionLabels: Record<ClipActionKind, string> = {
  extract: "Extract frames",
  gvm: "Generate alpha with GVM",
  videomama: "Generate alpha with VideoMaMa",
  inference: "Run CorridorKey"
};

function toAction(action: ClipActionKind): WorkflowAction {
  return {
    action,
    label: actionLabels[action]
  };
}

export function buildImportReview(paths: string[]): ImportReview {
  const sourceKinds = paths.map(detectImportSourceKind);
  const videoCount = sourceKinds.filter((kind) => kind === "video").length;
  const managedCount = sourceKinds.filter((kind) => kind !== "video").length;

  return {
    paths,
    sourceKinds,
    videoCount,
    managedCount,
    copySource: false
  };
}

export function detectImportSourceKind(targetPath: string): ImportSourceKind {
  const fileName = targetPath.split(/[\\/]/).pop() ?? targetPath;
  if (!fileName.includes(".")) {
    return "folder";
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (videoExtensions.has(extension)) {
    return "video";
  }
  if (imageExtensions.has(extension)) {
    return "image";
  }
  return "unknown";
}

export function describeImportSource(kind: ImportSourceKind): string {
  switch (kind) {
    case "video":
      return "Video";
    case "image":
      return "Image / frame";
    case "folder":
      return "Folder / sequence";
    default:
      return "Unknown source";
  }
}

export function formatClipState(state: string): string {
  return state.toLowerCase().replaceAll("_", " ");
}

export function summarizeWorkflow(clip: ClipDto | null): WorkflowSummary {
  if (!clip) {
    return {
      stageLabel: "No clip selected",
      headline: "Choose a clip to begin",
      description: "Pick a clip from the project list to see its workflow, issues, and next step.",
      primaryAction: null,
      secondaryActions: [],
      issues: []
    };
  }

  const available = new Set(clip.availableActions as ClipActionKind[]);
  const issues = [...clip.validationIssues];

  switch (clip.state) {
    case "EXTRACTING":
      return buildSummary(
        clip,
        "Needs extraction",
        "Create a managed frame sequence",
        "This clip still points at a source video. Extracting frames makes scrubbing, hint generation, and inference reliable.",
        available.has("extract") ? "extract" : null,
        []
      );
    case "RAW":
      if (available.has("extract")) {
        return buildSummary(
          clip,
          "Video imported",
          "Extract frames before continuing",
          "This is still a source video clip. Once frames exist, the app can preview the plate accurately and prepare alpha hints.",
          "extract",
          []
        );
      }
      if (available.has("gvm")) {
        return buildSummary(
          clip,
          "Plate ready",
          "Generate an alpha hint",
          "Your frames are ready, but CorridorKey still needs a coarse alpha hint before inference can run.",
          "gvm",
          []
        );
      }
      return buildSummary(
        clip,
        "Plate ready",
        "Alpha hint required",
        "This clip is staged correctly, but no alpha hint is available yet. Install GVM weights or add a hint manually.",
        null,
        []
      );
    case "MASKED":
      return buildSummary(
        clip,
        "Mask supplied",
        "Turn the mask into an alpha hint",
        "A VideoMaMa mask is present. Run VideoMaMa to convert that mask into a usable alpha hint for CorridorKey.",
        available.has("videomama") ? "videomama" : null,
        []
      );
    case "READY":
      return buildSummary(
        clip,
        "Inference ready",
        "Run CorridorKey",
        "The clip already has both frames and an alpha hint. Review a preview if needed, then run the full inference pass.",
        available.has("inference") ? "inference" : null,
        []
      );
    case "COMPLETE":
      return buildSummary(
        clip,
        "Outputs ready",
        "Review results or open the output folder",
        "CorridorKey has already produced outputs for this clip. Use the viewer to inspect frames or open the output folder to continue in comp.",
        null,
        []
      );
    case "ERROR": {
      const retryOrder: ClipActionKind[] = ["extract", "gvm", "videomama", "inference"];
      const primary = retryOrder.find((action) => available.has(action)) ?? null;
      return buildSummary(
        clip,
        "Needs attention",
        "Resolve the failed stage",
        "This clip hit an error in the pipeline. Start with the first retry option below and check the log panel for the exact backend message.",
        primary,
        retryOrder.filter((action) => action !== primary && available.has(action))
      );
    }
    default:
      return buildSummary(
        clip,
        formatClipState(clip.state),
        "Review clip status",
        "This clip has a state the desktop app does not recognize yet. Inspect the logs for more detail.",
        null,
        []
      );
  }
}

function buildSummary(
  clip: ClipDto,
  stageLabel: string,
  headline: string,
  description: string,
  primaryAction: ClipActionKind | null,
  secondaryActions: ClipActionKind[]
): WorkflowSummary {
  return {
    stageLabel,
    headline,
    description,
    primaryAction: primaryAction ? toAction(primaryAction) : null,
    secondaryActions: secondaryActions.map(toAction),
    issues: clip.validationIssues
  };
}

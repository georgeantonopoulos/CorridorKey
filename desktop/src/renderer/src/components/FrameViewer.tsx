import { useEffect, useMemo, useState } from "react";
import { frameUrl, previewFrame } from "../lib/api";
import type { ClipDto, SettingsState } from "../lib/types";

type ViewMode = "source" | "alpha_hint" | "preview_result" | "saved_comp";

type Props = {
  clip: ClipDto | null;
  settings: SettingsState;
};

const viewModeLabels: Record<ViewMode, string> = {
  source: "Source",
  alpha_hint: "Alpha hint",
  preview_result: "Preview",
  saved_comp: "Comp"
};

const defaultFrameIndex = 0;

export function FrameViewer({ clip, settings }: Props) {
  const [frameIndex, setFrameIndex] = useState(defaultFrameIndex);
  const [viewMode, setViewMode] = useState<ViewMode>("source");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setFrameIndex(defaultFrameIndex);
    setImageSrc(null);
    setPreviewError(null);
  }, [clip?.id]);

  const maxFrame = useMemo(() => Math.max((clip?.frameCount ?? 1) - 1, 0), [clip?.frameCount]);

  useEffect(() => {
    let cancelled = false;
    if (!clip) {
      return;
    }
    const currentClip: NonNullable<Props["clip"]> = clip;

    async function loadImage() {
      try {
        if (viewMode === "preview_result") {
          const preview = await previewFrame(currentClip.id, frameIndex, settings);
          if (!cancelled) {
            setImageSrc(`data:${preview.mimeType};base64,${preview.imageBase64}`);
            setPreviewError(null);
          }
          return;
        }

        const url = await frameUrl(currentClip.id, viewMode, frameIndex);
        if (!cancelled) {
          setImageSrc(url);
          setPreviewError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    const handle = window.setTimeout(loadImage, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [clip, frameIndex, viewMode, settings]);

  return (
    <div className="card viewer-card">
      <div className="panel-header">
        <h2>Frame Viewer</h2>
        <div className="segmented">
          {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
            <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => setViewMode(mode)}>
              {viewModeLabels[mode]}
            </button>
          ))}
        </div>
      </div>
      <div className="viewer-stage">
        {clip ? (
          imageSrc ? (
            <img src={imageSrc} alt={`${clip.name} frame ${frameIndex}`} className="viewer-image" />
          ) : (
            <div className="viewer-placeholder">{previewError ?? "Loading…"}</div>
          )
        ) : (
          <div className="viewer-placeholder">Select a clip to inspect frames.</div>
        )}
      </div>
      <div className="viewer-controls">
        <button disabled={!clip || frameIndex <= 0} onClick={() => setFrameIndex((value) => Math.max(value - 1, 0))}>
          Prev
        </button>
        <input
          type="range"
          min={0}
          max={maxFrame}
          value={frameIndex}
          disabled={!clip}
          onChange={(event) => setFrameIndex(Number(event.target.value))}
        />
        <button disabled={!clip || frameIndex >= maxFrame} onClick={() => setFrameIndex((value) => Math.min(value + 1, maxFrame))}>
          Next
        </button>
        <input
          type="number"
          min={0}
          max={maxFrame}
          value={frameIndex}
          disabled={!clip}
          onChange={(event) => setFrameIndex(Math.min(Math.max(Number(event.target.value), 0), maxFrame))}
        />
      </div>
    </div>
  );
}

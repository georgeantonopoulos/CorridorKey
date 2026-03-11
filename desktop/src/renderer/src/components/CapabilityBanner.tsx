import type { CapabilityDto, DownloadTaskDto } from "../lib/types";

type Props = {
  capabilities: CapabilityDto | null;
  downloads: DownloadTaskDto[];
  backendMessage: string | null;
  onDownload: (artifact: "gvm") => void;
};

export function CapabilityBanner({ capabilities, downloads, backendMessage, onDownload }: Props) {
  if (!capabilities) {
    return <div className="banner banner-muted">Waiting for backend capabilities… {backendMessage ?? ""}</div>;
  }

  const warnings = [...capabilities.warnings];
  if (!capabilities.ffmpegAvailable) {
    warnings.push("FFmpeg is missing; video import and extraction are disabled.");
  }
  if (!capabilities.torchCheckpointReady) {
    warnings.push("CorridorKey checkpoint is missing.");
  }
  const gvmDownload = downloads.find((task) => task.artifact === "gvm") ?? null;
  const gvmDownloading = gvmDownload?.status === "queued" || gvmDownload?.status === "running";
  const gvmLabel = gvmDownloading
    ? `Downloading GVM (${gvmDownload?.completedSteps ?? 0}/${gvmDownload?.totalSteps ?? 0})`
    : "Download GVM Weights";
  const gvmSizeHint = gvmDownload?.totalBytes ? formatBytes(gvmDownload.totalBytes) : "6.48 GB";
  const gvmProgressHint =
    gvmDownload && gvmDownloading
      ? `Progress: ${formatBytes(gvmDownload.completedBytes)} / ${formatBytes(gvmDownload.totalBytes)}. ${
          gvmDownload.currentFile ? `Current file: ${gvmDownload.currentFile} (${formatBytes(gvmDownload.currentFileBytes)}).` : ""
        }`
      : `GVM download size: about ${gvmSizeHint}.`;

  return (
    <div className={`banner ${warnings.length ? "banner-warn" : "banner-good"}`}>
      <strong>Device:</strong> {capabilities.detectedDevice} | <strong>Backend:</strong> {capabilities.detectedBackend}
      <span className="banner-spacer" />
      {warnings.length ? warnings.join(" ") : "All core capabilities look ready."}
      {!capabilities.gvmWeightsReady ? (
        <>
          <span className="banner-spacer" />
          <span>{gvmProgressHint}</span>
          <span className="banner-spacer" />
          <button type="button" disabled={gvmDownloading} onClick={() => onDownload("gvm")}>
            {gvmLabel}
          </button>
        </>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

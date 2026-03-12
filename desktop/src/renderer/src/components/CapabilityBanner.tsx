import type { CapabilityDto, DownloadTaskDto } from "../lib/types";

type Props = {
  capabilities: CapabilityDto | null;
  downloads: DownloadTaskDto[];
  backendMessage: string | null;
  onDownload: (artifact: "gvm") => void;
};

export function CapabilityBanner({ capabilities, downloads, backendMessage, onDownload }: Props) {
  if (!capabilities) {
    return <div className="banner banner-muted">Connecting to backend… {backendMessage ?? ""}</div>;
  }

  const warnings = [...capabilities.warnings];
  if (!capabilities.ffmpegAvailable) {
    warnings.push("FFmpeg missing — video import disabled.");
  }
  if (!capabilities.torchCheckpointReady) {
    warnings.push("CorridorKey checkpoint missing.");
  }

  const gvmDownload = downloads.find((task) => task.artifact === "gvm") ?? null;
  const gvmDownloading = gvmDownload?.status === "queued" || gvmDownload?.status === "running";
  const gvmLabel = gvmDownloading
    ? `Downloading GVM (${gvmDownload?.completedSteps ?? 0}/${gvmDownload?.totalSteps ?? 0})`
    : "Download GVM weights";
  const gvmSizeHint = gvmDownload?.totalBytes ? formatBytes(gvmDownload.totalBytes) : "~6.5 GB";
  const gvmProgressHint =
    gvmDownload && gvmDownloading
      ? `${formatBytes(gvmDownload.completedBytes)} / ${formatBytes(gvmDownload.totalBytes)}${
          gvmDownload.currentFile ? ` — ${gvmDownload.currentFile}` : ""
        }`
      : `GVM download: ${gvmSizeHint}`;

  return (
    <div className={`banner ${warnings.length ? "banner-warn" : "banner-good"}`}>
      <strong>{capabilities.detectedDevice}</strong>
      <span className="banner-spacer" />
      <span>{capabilities.detectedBackend}</span>
      <span className="banner-spacer" />
      {warnings.length ? warnings.join(" ") : "All systems ready."}
      {!capabilities.gvmWeightsReady ? (
        <>
          <span className="banner-spacer" />
          <span>{gvmProgressHint}</span>
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

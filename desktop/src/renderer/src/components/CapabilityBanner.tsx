import type { CapabilityDto, DownloadTaskDto } from "../lib/types";

type DownloadArtifact = "gvm" | "rvm";

type Props = {
  capabilities: CapabilityDto | null;
  downloads: DownloadTaskDto[];
  backendMessage: string | null;
  onDownload: (artifact: DownloadArtifact) => void;
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

  const installCards = [
    buildDownloadCard({
      artifact: "rvm",
      title: "RVM",
      subtitle: "Lightweight video matting for automatic alpha hints.",
      ready: capabilities.rvmAvailable,
      fallbackSize: "~18.85 MB",
      downloads,
      buttonLabel: "Download RVM"
    }),
    buildDownloadCard({
      artifact: "gvm",
      title: "GVM",
      subtitle: "Heavier automatic alpha generator.",
      ready: capabilities.gvmWeightsReady,
      fallbackSize: "~6.5 GB",
      downloads,
      buttonLabel: "Download GVM weights"
    })
  ].filter((card) => card !== null);

  return (
    <div className={`banner ${warnings.length ? "banner-warn" : "banner-good"}`}>
      <strong>{capabilities.detectedDevice}</strong>
      <span className="banner-spacer" />
      <span>{capabilities.detectedBackend}</span>
      <span className="banner-spacer" />
      {warnings.length ? warnings.join(" ") : "All systems ready."}
      {installCards.length > 0 ? (
        <div className="banner-downloads">
          {installCards.map((card) => (
            <div key={card.artifact} className="banner-download-card">
              <div className="banner-download-copy">
                <strong>{card.title}</strong>
                <span>{card.subtitle}</span>
                <span>{card.progressHint}</span>
              </div>
              <button type="button" disabled={card.downloading} onClick={() => onDownload(card.artifact)}>
                {card.buttonText}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type DownloadCardOptions = {
  artifact: DownloadArtifact;
  title: string;
  subtitle: string;
  ready: boolean;
  fallbackSize: string;
  downloads: DownloadTaskDto[];
  buttonLabel: string;
};

function buildDownloadCard({
  artifact,
  title,
  subtitle,
  ready,
  fallbackSize,
  downloads,
  buttonLabel
}: DownloadCardOptions) {
  if (ready) {
    return null;
  }

  const task = downloads.find((item) => item.artifact === artifact) ?? null;
  const downloading = task?.status === "queued" || task?.status === "running";
  const buttonText = downloading
    ? `Downloading ${title} (${task?.completedSteps ?? 0}/${task?.totalSteps ?? 0})`
    : buttonLabel;
  const progressHint = task && downloading
    ? `Progress: ${formatBytes(task.completedBytes)} / ${formatBytes(task.totalBytes)}${task.currentFile ? ` • Current file: ${task.currentFile}` : ""}`
    : `${title} download size: ${task?.totalBytes ? formatBytes(task.totalBytes) : fallbackSize}.`;

  return {
    artifact,
    title,
    subtitle,
    downloading,
    buttonText,
    progressHint
  };
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

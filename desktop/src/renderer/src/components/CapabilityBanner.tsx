import type { CapabilityDto } from "../lib/types";

type Props = {
  capabilities: CapabilityDto | null;
  backendMessage: string | null;
};

export function CapabilityBanner({ capabilities, backendMessage }: Props) {
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

  return (
    <div className={`banner ${warnings.length ? "banner-warn" : "banner-good"}`}>
      <strong>Device:</strong> {capabilities.detectedDevice} | <strong>Backend:</strong> {capabilities.detectedBackend}
      <span className="banner-spacer" />
      {warnings.length ? warnings.join(" ") : "All core capabilities look ready."}
    </div>
  );
}

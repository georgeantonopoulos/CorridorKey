from __future__ import annotations

from pydantic import BaseModel, Field


class ValidationIssueDto(BaseModel):
    severity: str
    code: str
    message: str
    path: str | None = None


class CapabilityDto(BaseModel):
    ffmpegAvailable: bool
    ffprobeAvailable: bool
    torchCheckpointReady: bool
    mlxCheckpointReady: bool
    gvmAvailable: bool
    videomamaAvailable: bool
    detectedDevice: str
    detectedBackend: str
    warnings: list[str] = Field(default_factory=list)


class JobDto(BaseModel):
    id: str
    clipId: str | None
    clipName: str
    jobType: str
    status: str
    currentFrame: int
    totalFrames: int
    phaseLabel: str | None
    startedAt: str | None
    finishedAt: str | None
    warningCount: int
    errorMessage: str | None


class ClipDto(BaseModel):
    id: str
    name: str
    state: str
    rootPath: str
    inputType: str | None
    frameCount: int
    alphaFrameCount: int
    validationIssues: list[ValidationIssueDto]
    currentJobId: str | None
    lastJobId: str | None
    availableActions: list[str]
    hasOutputs: bool


class ProjectDto(BaseModel):
    id: str
    displayName: str
    rootPath: str
    clipCount: int
    clips: list[ClipDto]


class PreviewRequest(BaseModel):
    frameIndex: int = 0
    settings: dict


class PreviewResponse(BaseModel):
    frameIndex: int
    width: int
    height: int
    sourceKind: str
    cacheKey: str
    mimeType: str
    imageBase64: str


class ImportRequest(BaseModel):
    paths: list[str]
    copySource: bool = True


class ClipActionRequest(BaseModel):
    settings: dict | None = None


class SnapshotDto(BaseModel):
    projects: list[ProjectDto]
    jobs: list[JobDto]
    capabilities: CapabilityDto
    logs: list[str]

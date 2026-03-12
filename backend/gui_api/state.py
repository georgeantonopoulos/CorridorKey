from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from huggingface_hub import hf_hub_download

from backend.clip_state import ClipEntry, ClipState, scan_project_clips
from backend.ffmpeg_tools import (
    extract_frames,
    find_ffmpeg,
    find_ffprobe,
    probe_video,
    write_video_metadata,
)
from backend.job_queue import GPUJob, GPUJobQueue, JobStatus, JobType
from backend.project import (
    get_display_name,
    is_image_file,
    is_video_file,
    projects_root,
    sanitize_stem,
    write_clip_json,
    write_project_json,
)
from backend.service import CorridorKeyService, InferenceParams
from CorridorKeyModule.backend import resolve_backend

from .models import CapabilityDto, ClipDto, DownloadTaskDto, JobDto, ProjectDto, SnapshotDto, ValidationIssueDto

logger = logging.getLogger(__name__)

GVM_REPO_ID = "geyongtao/gvm"
GVM_REQUIRED_FILES = [
    "scheduler/scheduler_config.json",
    "unet/config.json",
    "unet/diffusion_pytorch_model.safetensors",
    "vae/config.json",
    "vae/diffusion_pytorch_model.safetensors",
]
GVM_OPTIONAL_FILES = [
    "unet/adapter_config.json",
    "unet/pytorch_lora_weights.pt",
]
GVM_FILE_SIZES = {
    "scheduler/scheduler_config.json": 274,
    "unet/adapter_config.json": 873,
    "unet/config.json": 1060,
    "unet/diffusion_pytorch_model.safetensors": 6088185968,
    "unet/pytorch_lora_weights.pt": 2687354,
    "vae/config.json": 561,
    "vae/diffusion_pytorch_model.safetensors": 391017740,
}


@dataclass
class SourceCandidate:
    kind: str
    path: str
    display_name: str
    issues: list[ValidationIssueDto]


@dataclass
class DownloadTaskState:
    artifact: str
    status: str = "idle"
    completed_steps: int = 0
    total_steps: int = 0
    completed_bytes: int = 0
    total_bytes: int = 0
    current_file: str | None = None
    current_file_bytes: int = 0
    message: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    error_message: str | None = None


class _MemoryLogHandler(logging.Handler):
    def __init__(self, sink: deque[str]):
        super().__init__()
        self._sink = sink

    def emit(self, record: logging.LogRecord) -> None:
        self._sink.appendleft(self.format(record))


class GuiApiState:
    def __init__(self):
        self.service = CorridorKeyService()
        self.queue: GPUJobQueue = self.service.job_queue
        self.logs: deque[str] = deque(maxlen=80)
        self.download_tasks: dict[str, DownloadTaskState] = {}
        self.download_lock = threading.Lock()
        self.stop_event = threading.Event()
        self.worker_thread = threading.Thread(target=self._worker_loop, name="corridorkey-gui-worker", daemon=True)
        self.worker_thread.start()

        handler = _MemoryLogHandler(self.logs)
        handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
        logging.getLogger().addHandler(handler)

    def shutdown(self) -> None:
        self.stop_event.set()
        if self.worker_thread.is_alive():
            self.worker_thread.join(timeout=2)

    def _worker_loop(self) -> None:
        while not self.stop_event.is_set():
            job = self.queue.next_job()
            if job is None:
                time.sleep(0.1)
                continue

            self.queue.start_job(job)
            try:
                self._run_job(job)
            except Exception as error:  # pragma: no cover - defensive worker loop
                if job.is_cancelled:
                    self.queue.mark_cancelled(job)
                else:
                    self.queue.fail_job(job, str(error))
            else:
                if job.is_cancelled:
                    self.queue.mark_cancelled(job)
                else:
                    self.queue.complete_job(job)

    def _run_job(self, job: GPUJob) -> None:
        clip = self.load_clip(job.clip_id)
        if clip is None:
            raise RuntimeError(f"Unknown clip: {job.clip_id}")

        if job.job_type == JobType.VIDEO_EXTRACT:
            self.queue.report_phase("Extracting frames")
            self._extract_clip(clip, job)
            return

        if job.job_type == JobType.GVM_ALPHA:
            self.queue.report_phase("Generating GVM alpha")
            self.service.run_gvm(
                clip,
                job=job,
                on_progress=self.queue.report_progress,
                on_warning=self.queue.report_warning,
                on_status=self.queue.report_phase,
            )
            return

        if job.job_type == JobType.VIDEOMAMA_ALPHA:
            self.queue.report_phase("Loading VideoMaMa")
            self.service.run_videomama(
                clip,
                job=job,
                on_progress=self.queue.report_progress,
                on_warning=self.queue.report_warning,
                on_status=self.queue.report_phase,
            )
            return

        if job.job_type == JobType.INFERENCE:
            self.queue.report_phase("Running CorridorKey inference")
            settings = InferenceParams(**(job.params.get("settings") or {}))
            self.service.run_inference(
                clip,
                settings,
                job=job,
                on_progress=self.queue.report_progress,
                on_warning=self.queue.report_warning,
            )
            return

        raise RuntimeError(f"Unsupported job type: {job.job_type.value}")

    def _extract_clip(self, clip: ClipEntry, job: GPUJob) -> None:
        if clip.input_asset is None or clip.input_asset.asset_type != "video":
            raise RuntimeError(f"Clip '{clip.name}' does not have a video source to extract")

        clip_root = Path(clip.root_path)
        frames_dir = clip_root / "Frames"
        frames_dir.mkdir(exist_ok=True)

        cancel_event = threading.Event()

        def _progress(current: int, total: int) -> None:
            self.queue.report_progress(clip.name, current, total)
            clip.extraction_progress = current / max(total, 1)
            clip.extraction_total = total
            if job.is_cancelled:
                cancel_event.set()

        source_video = clip.input_asset.path
        metadata = probe_video(source_video)
        extracted = extract_frames(
            source_video,
            str(frames_dir),
            on_progress=_progress,
            cancel_event=cancel_event,
            total_frames=metadata["frame_count"],
        )
        write_video_metadata(clip.root_path, metadata)
        self.queue.report_progress(clip.name, extracted, metadata["frame_count"])

    def capabilities(self) -> CapabilityDto:
        warnings: list[str] = []
        detected_device = self.service.detect_device()
        try:
            detected_backend = resolve_backend()
        except Exception as error:
            detected_backend = "torch"
            warnings.append(str(error))

        torch_checkpoint = any(name.endswith(".pth") for name in os.listdir("CorridorKeyModule/checkpoints"))
        mlx_checkpoint = any(name.endswith(".safetensors") for name in os.listdir("CorridorKeyModule/checkpoints"))

        gvm_weights_ready = self._gvm_weights_ready()
        gvm_available = self._module_available("gvm_core") and os.path.isdir("gvm_core") and gvm_weights_ready
        videomama_available = self._module_available("VideoMaMaInferenceModule") and os.path.isdir(
            "VideoMaMaInferenceModule"
        )

        if not torch_checkpoint:
            warnings.append("CorridorKey .pth checkpoint is missing.")
        if self._module_available("gvm_core") and not gvm_weights_ready:
            warnings.append(
                "GVM weights are missing. Download them from the Desktop app or run "
                "`uv run hf download geyongtao/gvm --local-dir gvm_core/weights`."
            )
        if not find_ffmpeg():
            warnings.append("ffmpeg is not available on PATH.")
        if not find_ffprobe():
            warnings.append("ffprobe is not available on PATH.")

        return CapabilityDto(
            ffmpegAvailable=find_ffmpeg() is not None,
            ffprobeAvailable=find_ffprobe() is not None,
            torchCheckpointReady=torch_checkpoint,
            mlxCheckpointReady=mlx_checkpoint,
            gvmAvailable=gvm_available,
            gvmWeightsReady=gvm_weights_ready,
            videomamaAvailable=videomama_available,
            detectedDevice=detected_device,
            detectedBackend=detected_backend,
            warnings=warnings,
        )

    @staticmethod
    def _module_available(module_name: str) -> bool:
        try:
            __import__(module_name)
        except Exception:
            return False
        return True

    def list_projects(self) -> list[ProjectDto]:
        root = Path(projects_root())
        if not root.exists():
            return []
        projects: list[ProjectDto] = []
        for child in sorted(root.iterdir()):
          if not child.is_dir():
              continue
          project = self._project_dto(child)
          if project:
              projects.append(project)
        return projects

    def get_project(self, project_id: str) -> ProjectDto | None:
        root = Path(projects_root()) / project_id
        return self._project_dto(root)

    def _project_dto(self, project_root: Path) -> ProjectDto | None:
        if not project_root.is_dir():
            return None
        clips: list[ClipDto] = []
        for clip in scan_project_clips(str(project_root)):
            clips.append(self._clip_dto(project_root.name, clip))
        return ProjectDto(
            id=project_root.name,
            displayName=get_display_name(str(project_root)),
            rootPath=str(project_root),
            clipCount=len(clips),
            clips=clips,
        )

    def _clip_dto(self, project_id: str, clip: ClipEntry) -> ClipDto:
        issues = self._validation_issues(clip)
        clip_id = f"{project_id}/{Path(clip.root_path).name}"
        jobs = [job for job in self.queue.all_jobs_snapshot if job.clip_id == clip_id]
        current_job = next((job for job in jobs if job.status == JobStatus.RUNNING), None)
        last_job = jobs[-1] if jobs else None

        actions: list[str] = []
        if clip.state == ClipState.EXTRACTING:
            actions.append("extract")
        if clip.state == ClipState.RAW:
            if clip.input_asset and clip.input_asset.asset_type == "video":
                actions.append("extract")
            if self._gvm_ready():
                actions.append("gvm")
        if clip.state == ClipState.MASKED:
            actions.append("videomama")
        if clip.state == ClipState.READY:
            actions.append("inference")
        if clip.state == ClipState.ERROR and clip.input_asset and clip.input_asset.asset_type == "video":
            actions.append("extract")

        return ClipDto(
            id=clip_id,
            name=clip.name,
            state=clip.state.value,
            rootPath=clip.root_path,
            inputType=clip.input_asset.asset_type if clip.input_asset else None,
            frameCount=clip.input_asset.frame_count if clip.input_asset else 0,
            alphaFrameCount=clip.alpha_asset.frame_count if clip.alpha_asset else 0,
            validationIssues=issues,
            currentJobId=current_job.id if current_job else None,
            lastJobId=last_job.id if last_job else None,
            availableActions=actions,
            hasOutputs=clip.has_outputs,
        )

    def _validation_issues(self, clip: ClipEntry) -> list[ValidationIssueDto]:
        issues: list[ValidationIssueDto] = []
        if clip.input_asset is None:
            issues.append(
                ValidationIssueDto(
                    severity="error",
                    code="missing_input",
                    message="Input source is missing.",
                )
            )
        if clip.state == ClipState.EXTRACTING:
            issues.append(
                ValidationIssueDto(
                    severity="info",
                    code="needs_extraction",
                    message="Video source will be extracted to Frames for scrubbing and inference.",
                )
            )
        if clip.state == ClipState.RAW and clip.alpha_asset is None:
            issues.append(
                ValidationIssueDto(
                    severity="warning",
                    code="missing_alpha",
                    message="Alpha hint is missing. Run GVM or attach a matte hint.",
                )
            )
            if not self._gvm_ready():
                issues.append(
                    ValidationIssueDto(
                        severity="warning",
                        code="missing_gvm_weights",
                        message=(
                            "GVM is installed but its weights are missing. "
                            "Download them from the Desktop app setup banner to enable GVM."
                        ),
                    )
                )
        if clip.state == ClipState.MASKED:
            issues.append(
                ValidationIssueDto(
                    severity="info",
                    code="masked",
                    message="VideoMaMa mask is present. Generate an alpha hint to continue.",
                )
            )
        if clip.error_message:
            issues.append(
                ValidationIssueDto(
                    severity="error",
                    code="clip_error",
                    message=clip.error_message,
                )
            )
        return issues

    def load_clip(self, clip_id: str | None) -> ClipEntry | None:
        if not clip_id:
            return None
        project_id, clip_name = clip_id.split("/", 1)
        project_root = Path(projects_root()) / project_id
        clip_root = project_root / "clips" / clip_name
        if not clip_root.is_dir():
            clip_root = project_root / clip_name
        if not clip_root.is_dir():
            return None
        clip = ClipEntry(clip_name, str(clip_root))
        clip.find_assets()
        return clip

    def queue_clip_action(self, clip_id: str, action: str, settings: dict | None = None) -> JobDto:
        clip = self.load_clip(clip_id)
        if clip is None:
            raise RuntimeError(f"Unknown clip: {clip_id}")
        if action == "gvm" and not self._gvm_ready():
            raise RuntimeError(
                "GVM weights are missing. Download them from the Desktop app or run "
                "`uv run hf download geyongtao/gvm --local-dir gvm_core/weights`."
            )

        mapping = {
            "extract": JobType.VIDEO_EXTRACT,
            "gvm": JobType.GVM_ALPHA,
            "videomama": JobType.VIDEOMAMA_ALPHA,
            "inference": JobType.INFERENCE,
        }
        job_type = mapping[action]
        job = GPUJob(job_type=job_type, clip_name=clip.name, clip_id=clip_id, params={"settings": settings or {}})
        accepted = self.queue.submit(job)
        if not accepted:
            raise RuntimeError(f"{action} is already queued or running for {clip.name}")
        return self._job_dto(job)

    def cancel_job(self, job_id: str) -> None:
        job = self.queue.find_job_by_id(job_id)
        if job is None:
            raise RuntimeError(f"Unknown job: {job_id}")
        self.queue.cancel_job(job)

    def download_artifact(self, artifact: str) -> DownloadTaskDto:
        if artifact != "gvm":
            raise RuntimeError(f"Unsupported download artifact: {artifact}")

        with self.download_lock:
            existing = self.download_tasks.get(artifact)
            if existing and existing.status in {"queued", "running"}:
                return self._download_dto(existing)

            task = DownloadTaskState(
                artifact=artifact,
                status="queued",
                completed_steps=0,
                total_steps=len(GVM_REQUIRED_FILES) + len(GVM_OPTIONAL_FILES),
                completed_bytes=0,
                total_bytes=sum(GVM_FILE_SIZES[filename] for filename in [*GVM_REQUIRED_FILES, *GVM_OPTIONAL_FILES]),
                current_file=None,
                current_file_bytes=0,
                message="Queued GVM weight download.",
                started_at=datetime.now().isoformat(),
            )
            self.download_tasks[artifact] = task

        thread = threading.Thread(
            target=self._download_gvm_weights,
            args=(artifact,),
            name="corridorkey-download-gvm",
            daemon=True,
        )
        thread.start()
        return self._download_dto(task)

    def import_sources(self, paths: list[str], copy_source: bool) -> tuple[ProjectDto, list[ValidationIssueDto]]:
        candidates, issues = self._collect_candidates(paths)
        if not candidates:
            raise RuntimeError("No valid input sources were found.")

        project_root = self._create_project_root(candidates[0].display_name)
        clip_names: list[str] = []

        for candidate in candidates:
            clip_name = sanitize_stem(candidate.display_name)
            clip_dir = Path(project_root) / "clips" / clip_name
            counter = 2
            while clip_dir.exists():
                clip_dir = Path(project_root) / "clips" / f"{clip_name}_{counter}"
                counter += 1
            clip_dir.mkdir(parents=True, exist_ok=True)

            if candidate.kind == "video":
                source_dir = clip_dir / "Source"
                source_dir.mkdir(exist_ok=True)
                target = source_dir / Path(candidate.path).name
                if copy_source:
                    shutil.copy2(candidate.path, target)
                    source_path = str(target)
                else:
                    source_path = os.path.abspath(candidate.path)
                write_clip_json(
                    str(clip_dir),
                    {
                        "display_name": candidate.display_name,
                        "source": {
                            "original_path": os.path.abspath(candidate.path),
                            "filename": Path(candidate.path).name,
                            "copied": copy_source,
                        }
                    },
                )
                if not copy_source:
                    issues.append(
                        ValidationIssueDto(
                            severity="info",
                            code="reference_in_place",
                            message=f"{candidate.display_name} will reference the original source in place.",
                            path=source_path,
                        )
                    )
            else:
                frames_dir = clip_dir / "Frames"
                frames_dir.mkdir(exist_ok=True)
                source_path = candidate.path
                if os.path.isdir(source_path):
                    for filename in sorted(os.listdir(source_path)):
                        if is_image_file(filename):
                            shutil.copy2(os.path.join(source_path, filename), frames_dir / filename)
                else:
                    shutil.copy2(source_path, frames_dir / Path(source_path).name)
                write_clip_json(
                    str(clip_dir),
                    {
                        "display_name": candidate.display_name,
                        "source": {
                            "original_path": os.path.abspath(candidate.path),
                            "filename": Path(candidate.path).name,
                            "copied": True,
                        }
                    },
                )
            clip_names.append(clip_dir.name)

        write_project_json(
            project_root,
            {
                "version": 2,
                "created": datetime.now().isoformat(),
                "display_name": Path(project_root).name.split("_", 2)[-1].replace("_", " "),
                "clips": clip_names,
            },
        )

        project = self.get_project(Path(project_root).name)
        assert project is not None

        for clip in project.clips:
            if clip.state == "EXTRACTING":
                self.queue_clip_action(clip.id, "extract")

        return project, issues

    def _collect_candidates(self, paths: list[str]) -> tuple[list[SourceCandidate], list[ValidationIssueDto]]:
        candidates: list[SourceCandidate] = []
        issues: list[ValidationIssueDto] = []
        for raw_path in paths:
            path = os.path.abspath(raw_path)
            if os.path.isfile(path):
                if is_video_file(path):
                    candidates.append(SourceCandidate("video", path, Path(path).stem, []))
                elif is_image_file(path):
                    candidates.append(SourceCandidate("sequence", path, Path(path).stem, []))
                else:
                    issues.append(
                        ValidationIssueDto(
                            severity="error",
                            code="unsupported_file",
                            message="Unsupported file type.",
                            path=path,
                        )
                    )
                continue

            if not os.path.isdir(path):
                issues.append(
                    ValidationIssueDto(
                        severity="error",
                        code="missing_path",
                        message="Selected path does not exist.",
                        path=path,
                    )
                )
                continue

            entries = [entry for entry in os.listdir(path) if not entry.startswith(".")]
            if not entries:
                issues.append(
                    ValidationIssueDto(
                        severity="error",
                        code="empty_folder",
                        message="Folder is empty.",
                        path=path,
                    )
                )
                continue

            videos = [entry for entry in entries if is_video_file(entry)]
            images = [entry for entry in entries if is_image_file(entry)]
            unsupported = [entry for entry in entries if not is_video_file(entry) and not is_image_file(entry)]

            if videos and images:
                issues.append(
                    ValidationIssueDto(
                        severity="error",
                        code="mixed_media_folder",
                        message="Folder mixes videos and image frames; import them separately.",
                        path=path,
                    )
                )
                continue

            if videos:
                for video in videos:
                    candidates.append(SourceCandidate("video", os.path.join(path, video), Path(video).stem, []))
                if unsupported:
                    issues.append(
                        ValidationIssueDto(
                            severity="warning",
                            code="ignored_files",
                            message=f"Ignoring unsupported files: {', '.join(unsupported[:5])}",
                            path=path,
                        )
                    )
                continue

            if images:
                candidates.append(SourceCandidate("sequence", path, Path(path).name, []))
                if unsupported:
                    issues.append(
                        ValidationIssueDto(
                            severity="warning",
                            code="ignored_files",
                            message=f"Ignoring unsupported files: {', '.join(unsupported[:5])}",
                            path=path,
                        )
                    )
                continue

            issues.append(
                ValidationIssueDto(
                    severity="error",
                    code="unsupported_folder",
                    message="Folder does not contain a supported video or image sequence.",
                    path=path,
                )
            )
        return candidates, issues

    def _create_project_root(self, display_name: str) -> str:
        timestamp = datetime.now().strftime("%y%m%d_%H%M%S")
        name_stem = sanitize_stem(display_name)
        project_root = Path(projects_root()) / f"{timestamp}_{name_stem}"
        counter = 2
        while project_root.exists():
            project_root = Path(projects_root()) / f"{timestamp}_{name_stem}_{counter}"
            counter += 1
        (project_root / "clips").mkdir(parents=True, exist_ok=True)
        return str(project_root)

    def frame_png(self, clip_id: str, view: str, frame_index: int) -> bytes:
        clip = self.load_clip(clip_id)
        if clip is None or clip.input_asset is None:
            raise RuntimeError("Clip is not available")

        if view == "source":
            image = self._load_source_frame(clip, frame_index)
        elif view == "alpha_hint":
            image = self._load_alpha_frame(clip, frame_index)
        elif view == "saved_comp":
            image = self._load_saved_output(clip, "Comp", frame_index)
        elif view == "saved_fg":
            image = self._load_saved_output(clip, "FG", frame_index)
        elif view == "saved_matte":
            image = self._load_saved_output(clip, "Matte", frame_index)
        elif view == "saved_processed":
            image = self._load_saved_output(clip, "Processed", frame_index)
        else:
            raise RuntimeError(f"Unsupported view: {view}")

        ok, encoded = cv2.imencode(".png", image)
        if not ok:
            raise RuntimeError("Could not encode preview image")
        return encoded.tobytes()

    def preview_png(self, clip_id: str, frame_index: int, settings: dict) -> dict:
        clip = self.load_clip(clip_id)
        if clip is None:
            raise RuntimeError("Clip is not available")
        params = InferenceParams(**settings)
        result = self.service.reprocess_single_frame(clip, params, frame_index)
        if result is None:
            raise RuntimeError("Preview failed")
        comp = np.clip(result["comp"], 0.0, 1.0)
        bgr = cv2.cvtColor((comp * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)
        ok, encoded = cv2.imencode(".png", bgr)
        if not ok:
            raise RuntimeError("Could not encode preview image")
        return {
            "frameIndex": frame_index,
            "width": bgr.shape[1],
            "height": bgr.shape[0],
            "sourceKind": "preview_result",
            "cacheKey": f"{clip_id}:{frame_index}:{json.dumps(settings, sort_keys=True)}",
            "mimeType": "image/png",
            "imageBase64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        }

    def snapshot(self) -> SnapshotDto:
        return SnapshotDto(
            projects=self.list_projects(),
            jobs=[self._job_dto(job) for job in self.queue.all_jobs_snapshot],
            capabilities=self.capabilities(),
            downloads=self.downloads_snapshot(),
            logs=list(self.logs),
        )

    @staticmethod
    def _job_dto(job: GPUJob) -> JobDto:
        return JobDto(
            id=job.id,
            clipId=job.clip_id,
            clipName=job.clip_name,
            jobType=job.job_type.value,
            status=job.status.value,
            currentFrame=job.current_frame,
            totalFrames=job.total_frames,
            phaseLabel=job.phase_label,
            startedAt=job.started_at,
            finishedAt=job.finished_at,
            warningCount=job.warning_count,
            errorMessage=job.error_message,
        )

    def downloads_snapshot(self) -> list[DownloadTaskDto]:
        with self.download_lock:
            return [self._download_dto(task) for task in self.download_tasks.values()]

    @staticmethod
    def _download_dto(task: DownloadTaskState) -> DownloadTaskDto:
        return DownloadTaskDto(
            artifact=task.artifact,
            status=task.status,
            completedSteps=task.completed_steps,
            totalSteps=task.total_steps,
            completedBytes=task.completed_bytes,
            totalBytes=task.total_bytes,
            currentFile=task.current_file,
            currentFileBytes=task.current_file_bytes,
            message=task.message,
            startedAt=task.started_at,
            finishedAt=task.finished_at,
            errorMessage=task.error_message,
        )

    @staticmethod
    def _gvm_weights_root() -> Path:
        return Path("gvm_core") / "weights"

    def _gvm_weights_ready(self) -> bool:
        root = self._gvm_weights_root()
        return all((root / relative_path).is_file() for relative_path in GVM_REQUIRED_FILES)

    def _gvm_ready(self) -> bool:
        return self._module_available("gvm_core") and os.path.isdir("gvm_core") and self._gvm_weights_ready()

    def _download_gvm_weights(self, artifact: str) -> None:
        root = self._gvm_weights_root()
        root.mkdir(parents=True, exist_ok=True)
        files = [*GVM_REQUIRED_FILES, *GVM_OPTIONAL_FILES]

        with self.download_lock:
            task = self.download_tasks[artifact]
            task.status = "running"
            task.message = "Downloading GVM weights from Hugging Face..."
            task.error_message = None

        logger.info("Starting GVM weight download into %s", root)

        try:
            for index, filename in enumerate(files, start=1):
                with self.download_lock:
                    task = self.download_tasks[artifact]
                    task.current_file = filename
                    task.current_file_bytes = GVM_FILE_SIZES.get(filename, 0)
                    task.message = f"Downloading GVM file {index}/{len(files)}: {filename}"
                hf_hub_download(
                    repo_id=GVM_REPO_ID,
                    filename=filename,
                    local_dir=root,
                )
                with self.download_lock:
                    task = self.download_tasks[artifact]
                    task.completed_steps = index
                    task.completed_bytes += GVM_FILE_SIZES.get(filename, 0)
                    task.message = f"Downloaded {index}/{len(files)} GVM files."

            with self.download_lock:
                task = self.download_tasks[artifact]
                task.status = "completed"
                task.current_file = None
                task.current_file_bytes = 0
                task.finished_at = datetime.now().isoformat()
                task.message = "GVM weights downloaded successfully."
            logger.info("GVM weights downloaded successfully.")
        except Exception as error:
            logger.exception("Failed to download GVM weights")
            with self.download_lock:
                task = self.download_tasks[artifact]
                task.status = "failed"
                task.current_file = None
                task.finished_at = datetime.now().isoformat()
                task.error_message = str(error)
                task.message = "GVM weight download failed."

    @staticmethod
    def _load_source_frame(clip: ClipEntry, frame_index: int) -> np.ndarray:
        from backend.frame_io import read_image_frame, read_video_frame_at

        if clip.input_asset is None:
            raise RuntimeError("Clip has no input asset")
        if clip.input_asset.asset_type == "video":
            image = read_video_frame_at(clip.input_asset.path, frame_index)
        else:
            files = clip.input_asset.get_frame_files()
            image = read_image_frame(os.path.join(clip.input_asset.path, files[frame_index]))
        if image is None:
            raise RuntimeError("Could not read source frame")
        rgb = np.clip(image, 0.0, 1.0)
        return cv2.cvtColor((rgb * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)

    @staticmethod
    def _load_alpha_frame(clip: ClipEntry, frame_index: int) -> np.ndarray:
        from backend.frame_io import read_mask_frame, read_video_mask_at

        if clip.alpha_asset is None:
            raise RuntimeError("Clip has no alpha hint")
        if clip.alpha_asset.asset_type == "video":
            mask = read_video_mask_at(clip.alpha_asset.path, frame_index)
        else:
            files = clip.alpha_asset.get_frame_files()
            mask = read_mask_frame(os.path.join(clip.alpha_asset.path, files[frame_index]))
        if mask is None:
            raise RuntimeError("Could not read alpha frame")
        gray = (np.clip(mask, 0.0, 1.0) * 255.0).astype(np.uint8)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _load_saved_output(clip: ClipEntry, folder: str, frame_index: int) -> np.ndarray:
        out_dir = Path(clip.root_path) / "Output" / folder
        if not out_dir.is_dir():
            raise RuntimeError(f"{folder} output does not exist yet")
        files = sorted(file for file in out_dir.iterdir() if file.is_file())
        if frame_index >= len(files):
            raise RuntimeError("Requested output frame is out of range")
        image = cv2.imread(str(files[frame_index]), cv2.IMREAD_UNCHANGED)
        if image is None:
            raise RuntimeError("Could not read output frame")
        if image.ndim == 2:
            return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        if image.shape[2] == 4:
            image = image[:, :, :3]
        if image.dtype != np.uint8:
            image = (np.clip(image, 0.0, 1.0) * 255.0).astype(np.uint8)
        return image

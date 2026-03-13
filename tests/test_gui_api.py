from __future__ import annotations

import base64
import time
from pathlib import Path

from fastapi.testclient import TestClient

from backend.gui_api.app import app, gui_state
from backend.gui_api.models import CapabilityDto, DownloadTaskDto, ProjectDto, SnapshotDto, ValidationIssueDto
from backend.gui_api.state import GuiApiState


class _FakeState:
    def __init__(self):
        self.cancelled_job_id = None

    def capabilities(self):
        return CapabilityDto(
            ffmpegAvailable=True,
            ffprobeAvailable=True,
            torchCheckpointReady=True,
            mlxCheckpointReady=False,
            gvmAvailable=True,
            gvmWeightsReady=True,
            rvmAvailable=True,
            rvmWeightsReady=True,
            videomamaAvailable=False,
            detectedDevice="cpu",
            detectedBackend="torch",
            warnings=[],
        )

    def list_projects(self):
        return []

    def get_project(self, project_id: str):
        return ProjectDto(id=project_id, displayName="Demo", rootPath="/tmp/demo", clipCount=0, clips=[])

    def import_sources(self, paths, copy_source):
        return self.get_project("demo"), [ValidationIssueDto(severity="info", code="accepted", message="ok")]

    def queue_clip_action(self, clip_id, action, settings=None):
        return {
            "id": "job-1",
            "clipId": clip_id,
            "clipName": "clip",
            "jobType": action,
            "status": "queued",
            "currentFrame": 0,
            "totalFrames": 10,
            "phaseLabel": None,
            "startedAt": None,
            "finishedAt": None,
            "warningCount": 0,
            "errorMessage": None,
        }

    def cancel_job(self, job_id: str):
        self.cancelled_job_id = job_id
        return None

    def download_artifact(self, artifact: str):
        total_steps = 2 if artifact == "rvm" else 7
        total_bytes = 19792941 if artifact == "rvm" else 6481893830
        return DownloadTaskDto(
            artifact=artifact,
            status="queued",
            completedSteps=0,
            totalSteps=total_steps,
            completedBytes=0,
            totalBytes=total_bytes,
            currentFile=None,
            currentFileBytes=0,
            message="queued",
            startedAt=None,
            finishedAt=None,
            errorMessage=None,
        )

    def frame_png(self, clip_id: str, view: str, frame_index: int):
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9W8LdnQAAAAASUVORK5CYII="
        )
        return png_bytes

    def preview_png(self, clip_id: str, frame_index: int, settings: dict):
        return {
            "frameIndex": frame_index,
            "width": 1,
            "height": 1,
            "sourceKind": "preview_result",
            "cacheKey": "demo",
            "mimeType": "image/png",
            "imageBase64": "aGVsbG8=",
        }

    def snapshot(self):
        return SnapshotDto(projects=[], jobs=[], capabilities=self.capabilities(), downloads=[], logs=["hello"])


def test_health_endpoint_with_auth(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.get("/health", headers={"Authorization": "Bearer secret"})
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}
    finally:
        app.dependency_overrides.clear()


def test_cors_preflight_allows_renderer_import_request(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.options(
                "/projects/import",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization,content-type",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
            allowed_headers = response.headers["access-control-allow-headers"].lower()
            assert "authorization" in allowed_headers
            assert "content-type" in allowed_headers
    finally:
        app.dependency_overrides.clear()


def test_capabilities_response_includes_cors_headers(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.get(
                "/capabilities",
                headers={
                    "Origin": "http://localhost:5173",
                    "Authorization": "Bearer secret",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    finally:
        app.dependency_overrides.clear()


def test_download_endpoint_queues_artifact(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.post("/downloads/gvm", headers={"Authorization": "Bearer secret"})
            assert response.status_code == 200
            assert response.json()["artifact"] == "gvm"
            assert response.json()["status"] == "queued"
    finally:
        app.dependency_overrides.clear()


def test_download_rvm_endpoint_queues_artifact(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.post("/downloads/rvm", headers={"Authorization": "Bearer secret"})
            assert response.status_code == 200
            assert response.json()["artifact"] == "rvm"
            assert response.json()["status"] == "queued"
    finally:
        app.dependency_overrides.clear()


def test_cancel_endpoint_invokes_state(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    fake_state = _FakeState()
    app.dependency_overrides[gui_state] = lambda: fake_state
    try:
        with TestClient(app) as client:
            response = client.post("/jobs/job-42/cancel", headers={"Authorization": "Bearer secret"})
            assert response.status_code == 200
            assert fake_state.cancelled_job_id == "job-42"
    finally:
        app.dependency_overrides.clear()


def test_frame_endpoint_returns_png(monkeypatch):
    monkeypatch.setenv("CORRIDORKEY_GUI_API_TOKEN", "secret")
    app.dependency_overrides[gui_state] = lambda: _FakeState()
    try:
        with TestClient(app) as client:
            response = client.get(
                "/clips/demo/clip/frame",
                params={"view": "source", "frameIndex": 0, "authToken": "secret"},
            )
            assert response.status_code == 200
            assert response.headers["content-type"] == "image/png"
            assert response.content.startswith(b"\x89PNG")
    finally:
        app.dependency_overrides.clear()


def test_import_sequence_creates_project(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    seq_dir = tmp_path / "Sequence"
    seq_dir.mkdir()
    for index in range(2):
        (seq_dir / f"frame_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))

    state = GuiApiState()
    try:
        project, issues = state.import_sources([str(seq_dir)], copy_source=True)
        assert project.clipCount == 1
        clip = project.clips[0]
        assert clip.state == "RAW"
        assert not issues
        clip_root = Path(project.rootPath) / "clips" / Path(clip.id).name / "Frames"
        assert clip_root.is_dir()
    finally:
        state.shutdown()


def test_collect_candidates_rejects_mixed_media_folder(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    mixed_dir = tmp_path / "Mixed"
    mixed_dir.mkdir()
    (mixed_dir / "clip.mov").write_bytes(b"video")
    (mixed_dir / "frame_0001.png").write_bytes(b"frame")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))

    state = GuiApiState()
    try:
        candidates, issues = state._collect_candidates([str(mixed_dir)])
        assert not candidates
        assert any(issue.code == "mixed_media_folder" for issue in issues)
    finally:
        state.shutdown()


def test_snapshot_contains_logs(monkeypatch):
    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: "/tmp/nonexistent")
    state = GuiApiState()
    try:
        snapshot = state.snapshot()
        assert snapshot.logs is not None
        assert snapshot.downloads == []
        assert snapshot.capabilities.detectedDevice in {"cpu", "mps", "cuda"}
    finally:
        state.shutdown()


def test_raw_clip_hides_gvm_action_when_weights_are_missing(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    seq_dir = tmp_path / "Sequence"
    seq_dir.mkdir()
    for index in range(2):
        (seq_dir / f"frame_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))
    monkeypatch.setattr(GuiApiState, "_gvm_ready", lambda self: False)
    monkeypatch.setattr(GuiApiState, "_rvm_ready", lambda self: False)

    state = GuiApiState()
    try:
        project, _issues = state.import_sources([str(seq_dir)], copy_source=True)
        clip = project.clips[0]
        assert "gvm" not in clip.availableActions
        assert "rvm" not in clip.availableActions
        assert any(issue.code == "missing_gvm_weights" for issue in clip.validationIssues)
        assert any(issue.code == "missing_rvm" for issue in clip.validationIssues)
    finally:
        state.shutdown()


def test_raw_clip_prefers_rvm_action_when_available(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    seq_dir = tmp_path / "Sequence"
    seq_dir.mkdir()
    for index in range(2):
        (seq_dir / f"frame_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))
    monkeypatch.setattr(GuiApiState, "_gvm_ready", lambda self: True)
    monkeypatch.setattr(GuiApiState, "_rvm_ready", lambda self: True)

    state = GuiApiState()
    try:
        project, _issues = state.import_sources([str(seq_dir)], copy_source=True)
        clip = project.clips[0]
        assert clip.availableActions[:2] == ["rvm", "gvm"]
    finally:
        state.shutdown()


def test_ready_clip_keeps_alpha_generators_available(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    clip_dir = projects_dir / "demo" / "clips" / "shot"
    frames_dir = clip_dir / "Frames"
    alpha_dir = clip_dir / "AlphaHint"
    frames_dir.mkdir(parents=True)
    alpha_dir.mkdir(parents=True)
    for index in range(2):
        (frames_dir / f"frame_{index:04d}.png").write_bytes(b"fake")
        (alpha_dir / f"frame_{index:04d}_alphaHint_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))
    monkeypatch.setattr(GuiApiState, "_gvm_ready", lambda self: True)
    monkeypatch.setattr(GuiApiState, "_rvm_ready", lambda self: True)

    state = GuiApiState()
    try:
        project = state.get_project("demo")
        assert project is not None
        clip = project.clips[0]
        assert clip.state == "READY"
        assert clip.availableActions == ["inference", "rvm", "gvm"]
    finally:
        state.shutdown()


def test_queue_gvm_rejects_when_weights_are_missing(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    seq_dir = tmp_path / "Sequence"
    seq_dir.mkdir()
    for index in range(2):
        (seq_dir / f"frame_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))
    monkeypatch.setattr(GuiApiState, "_gvm_ready", lambda self: False)
    monkeypatch.setattr(GuiApiState, "_rvm_ready", lambda self: False)

    state = GuiApiState()
    try:
        project, _issues = state.import_sources([str(seq_dir)], copy_source=True)
        clip = project.clips[0]
        try:
            state.queue_clip_action(clip.id, "gvm")
        except RuntimeError as error:
            assert "GVM weights are missing" in str(error)
        else:
            raise AssertionError("Expected queue_clip_action to reject missing GVM weights")
    finally:
        state.shutdown()


def test_queue_rvm_rejects_when_files_are_missing(monkeypatch, tmp_path):
    projects_dir = tmp_path / "Projects"
    seq_dir = tmp_path / "Sequence"
    seq_dir.mkdir()
    for index in range(2):
        (seq_dir / f"frame_{index:04d}.png").write_bytes(b"fake")

    monkeypatch.setattr("backend.gui_api.state.projects_root", lambda: str(projects_dir))
    monkeypatch.setattr(GuiApiState, "_rvm_ready", lambda self: False)

    state = GuiApiState()
    try:
        project, _issues = state.import_sources([str(seq_dir)], copy_source=True)
        clip = project.clips[0]
        try:
            state.queue_clip_action(clip.id, "rvm")
        except RuntimeError as error:
            assert "RVM files are missing" in str(error)
        else:
            raise AssertionError("Expected queue_clip_action to reject missing RVM files")
    finally:
        state.shutdown()


def test_download_gvm_artifact_marks_weights_ready(monkeypatch, tmp_path):
    weights_root = tmp_path / "weights"

    def fake_download(repo_id: str, filename: str, local_dir: Path):
        assert repo_id == "geyongtao/gvm"
        target = Path(local_dir) / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("ok")
        return str(target)

    monkeypatch.setattr("backend.gui_api.state.hf_hub_download", fake_download)
    monkeypatch.setattr(GuiApiState, "_gvm_weights_root", staticmethod(lambda: weights_root))
    monkeypatch.setattr(GuiApiState, "_module_available", staticmethod(lambda _module_name: True))

    state = GuiApiState()
    try:
        task = state.download_artifact("gvm")
        assert task.status == "queued"

        for _ in range(100):
            snapshot = state.downloads_snapshot()
            if snapshot and snapshot[0].status == "completed":
                break
            time.sleep(0.01)

        snapshot = state.downloads_snapshot()
        assert snapshot[0].status == "completed"
        assert snapshot[0].totalBytes == 6481893830
        assert snapshot[0].completedBytes == 6481893830
        assert state.capabilities().gvmWeightsReady is True
        assert state.capabilities().gvmAvailable is True
    finally:
        state.shutdown()


def test_download_rvm_artifact_marks_files_ready(monkeypatch, tmp_path):
    downloads_root = tmp_path / "downloads"
    source_root = tmp_path / "upstream" / "RobustVideoMatting-1.0.0"
    weights_path = tmp_path / "weights" / "rvm_mobilenetv3.pth"

    def fake_download(url: str, destination: Path):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(url)

    def fake_extract(_archive_path: Path, destination_root: Path):
        target = destination_root / "RobustVideoMatting-1.0.0" / "model"
        target.mkdir(parents=True, exist_ok=True)
        (target / "model.py").write_text("ok")

    monkeypatch.setattr(GuiApiState, "_download_url_to_path", staticmethod(fake_download))
    monkeypatch.setattr(GuiApiState, "_extract_tarball", staticmethod(fake_extract))
    monkeypatch.setattr(GuiApiState, "_rvm_source_archive_path", staticmethod(lambda: downloads_root / "rvm.tar.gz"))
    monkeypatch.setattr(GuiApiState, "_rvm_source_root", staticmethod(lambda: source_root))
    monkeypatch.setattr(GuiApiState, "_rvm_weights_path", staticmethod(lambda: weights_path))

    state = GuiApiState()
    try:
        task = state.download_artifact("rvm")
        assert task.status in {"queued", "running"}

        for _ in range(100):
            snapshot = state.downloads_snapshot()
            if snapshot and snapshot[0].status == "completed":
                break
            time.sleep(0.01)

        snapshot = state.downloads_snapshot()
        assert snapshot[0].status == "completed"
        assert snapshot[0].totalBytes == 19792941
        assert snapshot[0].completedBytes == 19792941
        assert state.capabilities().rvmWeightsReady is True
        assert state.capabilities().rvmAvailable is True
    finally:
        state.shutdown()

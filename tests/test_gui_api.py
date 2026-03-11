from __future__ import annotations

import base64
from pathlib import Path

from fastapi.testclient import TestClient

from backend.gui_api.app import app, gui_state
from backend.gui_api.models import CapabilityDto, ProjectDto, SnapshotDto, ValidationIssueDto
from backend.gui_api.state import GuiApiState


class _FakeState:
    def capabilities(self):
        return CapabilityDto(
            ffmpegAvailable=True,
            ffprobeAvailable=True,
            torchCheckpointReady=True,
            mlxCheckpointReady=False,
            gvmAvailable=True,
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
        return None

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
        return SnapshotDto(projects=[], jobs=[], capabilities=self.capabilities(), logs=["hello"])


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
        assert snapshot.capabilities.detectedDevice in {"cpu", "mps", "cuda"}
    finally:
        state.shutdown()

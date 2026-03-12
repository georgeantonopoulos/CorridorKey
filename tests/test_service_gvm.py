from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from backend.errors import JobCancelledError
from backend.job_queue import GPUJob, JobType
from backend.service import CorridorKeyService


def make_clip(tmp_path: Path):
    clip_root = tmp_path / "clip"
    clip_root.mkdir()
    frames_dir = clip_root / "Frames"
    frames_dir.mkdir()
    (frames_dir / "frame_0000.png").write_bytes(b"placeholder")
    clip = SimpleNamespace(
        name="demo_clip",
        root_path=str(clip_root),
        input_asset=SimpleNamespace(path=str(frames_dir), asset_type="sequence"),
        alpha_asset=None,
        transition_to=lambda _state: None,
    )
    return clip


def test_run_gvm_reports_detailed_status_and_progress(tmp_path):
    service = CorridorKeyService()
    clip = make_clip(tmp_path)
    progress_events: list[tuple[str, int, int]] = []
    status_events: list[str] = []

    class DummyGVM:
        def process_sequence(self, *, direct_output_dir, progress_callback=None, **_kwargs):
            for frame_index in range(1, 4):
                matte = np.full((4, 4), 255, dtype=np.uint8)
                cv2.imwrite(str(Path(direct_output_dir) / f"frame_{frame_index:04d}.png"), matte)
                if progress_callback is not None:
                    progress_callback(frame_index, 3)

    service._get_gvm = lambda: DummyGVM()

    service.run_gvm(
        clip,
        on_progress=lambda name, current, total: progress_events.append((name, current, total)),
        on_status=status_events.append,
    )

    assert progress_events[-1] == ("demo_clip", 3, 3)
    assert any(status.startswith("GVM progress: 1/3 frames") for status in status_events)
    assert any(status.startswith("GVM progress: 3/3 frames") for status in status_events)


def test_run_gvm_cancels_after_progress_callback_requests_cancel(tmp_path):
    service = CorridorKeyService()
    clip = make_clip(tmp_path)
    job = GPUJob(job_type=JobType.GVM_ALPHA, clip_name=clip.name)

    class DummyGVM:
        def process_sequence(self, *, progress_callback=None, **_kwargs):
            if progress_callback is not None:
                progress_callback(1, 4)
                progress_callback(2, 4)

    service._get_gvm = lambda: DummyGVM()

    def on_progress(_clip_name: str, current: int, _total: int):
        if current == 1:
            job.request_cancel()

    with pytest.raises(JobCancelledError, match="job cancelled"):
        service.run_gvm(clip, job=job, on_progress=on_progress)

from __future__ import annotations

import inspect

from gvm_core.wrapper import GVMProcessor, enable_device_optimizations


def test_gvm_process_sequence_accepts_progress_callback():
    signature = inspect.signature(GVMProcessor.process_sequence)
    assert "progress_callback" in signature.parameters


def test_enable_device_optimizations_uses_attention_slicing_on_mps():
    class DummyPipe:
        def __init__(self):
            self.calls = 0

        def enable_attention_slicing(self):
            self.calls += 1

    class DummyDevice:
        type = "mps"

    pipe = DummyPipe()
    enable_device_optimizations(pipe, DummyDevice())
    assert pipe.calls == 1

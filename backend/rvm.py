from __future__ import annotations

from pathlib import Path

RVM_RELEASE_TAG = "v1.0.0"
RVM_SOURCE_DIRNAME = "RobustVideoMatting-1.0.0"
RVM_SOURCE_ARCHIVE_NAME = f"{RVM_SOURCE_DIRNAME}.tar.gz"
RVM_SOURCE_ARCHIVE_URL = f"https://github.com/PeterL1n/RobustVideoMatting/archive/refs/tags/{RVM_RELEASE_TAG}.tar.gz"
RVM_MOBILENET_WEIGHTS_FILENAME = "rvm_mobilenetv3.pth"
RVM_MOBILENET_WEIGHTS_URL = (
    "https://github.com/PeterL1n/RobustVideoMatting/releases/download/"
    f"{RVM_RELEASE_TAG}/{RVM_MOBILENET_WEIGHTS_FILENAME}"
)

# Verified from the current upstream release payloads on 2026-03-13.
RVM_SOURCE_ARCHIVE_SIZE = 4575220
RVM_MOBILENET_WEIGHTS_SIZE = 15217721
_LEGACY_TORCHVISION_IMPORT = "from torchvision.models.utils import load_state_dict_from_url\n"
_COMPAT_TORCHVISION_IMPORT = (
    "try:\n"
    "    from torchvision._internally_replaced_utils import load_state_dict_from_url\n"
    "except ImportError:\n"
    "    from torch.hub import load_state_dict_from_url\n"
)


def root(base_dir: str | Path = ".") -> Path:
    return Path(base_dir) / "rvm_core"


def downloads_root(base_dir: str | Path = ".") -> Path:
    return root(base_dir) / "downloads"


def source_cache_root(base_dir: str | Path = ".") -> Path:
    return root(base_dir) / "upstream"


def source_root(base_dir: str | Path = ".") -> Path:
    return source_cache_root(base_dir) / RVM_SOURCE_DIRNAME


def source_archive_path(base_dir: str | Path = ".") -> Path:
    return downloads_root(base_dir) / RVM_SOURCE_ARCHIVE_NAME


def weights_root(base_dir: str | Path = ".") -> Path:
    return root(base_dir) / "weights"


def weights_path(base_dir: str | Path = ".") -> Path:
    return weights_root(base_dir) / RVM_MOBILENET_WEIGHTS_FILENAME


def ensure_torchvision_compatibility(base_dir: str | Path = ".") -> None:
    for relative_path in ("model/mobilenetv3.py", "model/resnet.py"):
        target = source_root(base_dir) / relative_path
        if not target.is_file():
            continue
        content = target.read_text()
        if _LEGACY_TORCHVISION_IMPORT not in content:
            continue
        target.write_text(content.replace(_LEGACY_TORCHVISION_IMPORT, _COMPAT_TORCHVISION_IMPORT))


def source_ready(base_dir: str | Path = ".") -> bool:
    return (source_root(base_dir) / "model" / "model.py").is_file()


def weights_ready(base_dir: str | Path = ".") -> bool:
    return weights_path(base_dir).is_file()

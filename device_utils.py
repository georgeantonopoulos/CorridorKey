"""Centralized cross-platform device selection for CorridorKey."""

import logging
import os

import torch

logger = logging.getLogger(__name__)

DEVICE_ENV_VAR = "CORRIDORKEY_DEVICE"
VALID_DEVICES = ("auto", "cuda", "mps", "cpu")


def detect_best_device() -> str:
    """Auto-detect best available device: CUDA > MPS > CPU."""
    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    logger.info("Auto-selected device: %s", device)
    return device


def resolve_device(requested: str | None = None) -> str:
    """Resolve device from explicit request > env var > auto-detect.

    Args:
        requested: Device string from CLI arg. None or "auto" triggers
                   env var lookup then auto-detection.

    Returns:
        Validated device string ("cuda", "mps", or "cpu").

    Raises:
        RuntimeError: If the requested backend is unavailable.
    """
    # CLI arg takes priority, then env var, then auto
    device = requested
    if device is None or device == "auto":
        device = os.environ.get(DEVICE_ENV_VAR, "auto")

    if device == "auto":
        return detect_best_device()

    device = device.lower()
    if device not in VALID_DEVICES:
        raise RuntimeError(f"Unknown device '{device}'. Valid options: {', '.join(VALID_DEVICES)}")

    # Validate the explicit request
    if device == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError(
                "CUDA requested but torch.cuda.is_available() is False. Install a CUDA-enabled PyTorch build."
            )
    elif device == "mps":
        if not hasattr(torch.backends, "mps"):
            raise RuntimeError(
                "MPS requested but this PyTorch build has no MPS support. Install PyTorch >= 1.12 with MPS backend."
            )
        if not torch.backends.mps.is_available():
            raise RuntimeError(
                "MPS requested but not available on this machine. Requires Apple Silicon (M1+) with macOS 12.3+."
            )

    return device


def clear_device_cache(device: torch.device | str) -> None:
    """Clear GPU memory cache if applicable (no-op for CPU)."""
    device_type = device.type if isinstance(device, torch.device) else device
    if device_type == "cuda":
        torch.cuda.empty_cache()
    elif device_type == "mps":
        torch.mps.empty_cache()


def get_system_memory_gb() -> float:
    """Return total system RAM in GB. Works on macOS, Linux, Windows."""
    try:
        # POSIX: macOS and Linux (os is already imported at module level)
        if hasattr(os, "sysconf"):
            pages = os.sysconf("SC_PHYS_PAGES")
            page_size = os.sysconf("SC_PAGE_SIZE")
            if pages > 0 and page_size > 0:
                return (pages * page_size) / (1024**3)
    except (ValueError, OSError):
        pass

    try:
        import psutil

        return psutil.virtual_memory().total / (1024**3)
    except ImportError:
        pass

    logger.warning("Could not determine system memory — assuming 16GB")
    return 16.0


# Resolution thresholds for MPS: (min_memory_gb, img_size)
# Evaluated top-down; first match wins.
# MPS lacks FlashAttention so ViT attention cost is quadratic in spatial tokens.
# 2048 is ~16× slower than 1024 — reserve it for explicit user override only.
# Users who want 2048 on MPS can pass --img-size 2048.
_MPS_RESOLUTION_TIERS = [
    (32.0, 1536),
    (0.0, 1024),
]


def recommend_mps_img_size(
    system_memory_gb: float,
    device: str = "mps",
    user_img_size: int | None = None,
) -> int:
    """Recommend img_size for MPS based on available system memory.

    Args:
        system_memory_gb: Total system RAM in GB.
        device: Target device string. Only "mps" triggers auto-scaling.
        user_img_size: If provided, returned as-is (user override).

    Returns:
        Recommended img_size (1024, 1536, or 2048).
    """
    if user_img_size is not None:
        return user_img_size

    if device != "mps":
        return 2048

    for min_mem, size in _MPS_RESOLUTION_TIERS:
        if system_memory_gb >= min_mem:
            if size != 2048:
                logger.info(
                    "MPS auto-scale: %.0fGB RAM → img_size=%d (use --img-size to override)",
                    system_memory_gb,
                    size,
                )
            return size

    return 1024  # fallback

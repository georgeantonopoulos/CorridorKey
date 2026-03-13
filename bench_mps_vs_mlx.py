"""Quick benchmark: Torch/MPS vs MLX at multiple resolutions.

Usage:  uv run python bench_mps_vs_mlx.py
"""

import time
import statistics
import numpy as np
import torch

RESOLUTIONS = [1024, 1536, 2048]
WARMUP_FRAMES = 2
BENCH_FRAMES = 5


def bench_torch_mps(img_size: int) -> dict:
    """Benchmark Torch/MPS inference at a given resolution."""
    from CorridorKeyModule.inference_engine import CorridorKeyEngine

    print(f"\n  [Torch/MPS] Loading model at img_size={img_size}...")
    t0 = time.perf_counter()
    engine = CorridorKeyEngine(
        checkpoint_path="CorridorKeyModule/checkpoints/CorridorKey.pth",
        device="mps",
        img_size=img_size,
        mixed_precision=True,
    )
    load_time = time.perf_counter() - t0
    print(f"  [Torch/MPS] Model loaded in {load_time:.1f}s")

    # Synthetic frame (random green-screen-ish image)
    rng = np.random.RandomState(42)
    rgb = rng.rand(1080, 1920, 3).astype(np.float32)
    mask = rng.rand(1080, 1920).astype(np.float32)

    # Warmup
    print(f"  [Torch/MPS] Warming up ({WARMUP_FRAMES} frames)...")
    for _ in range(WARMUP_FRAMES):
        engine.process_frame(rgb, mask)

    # Timed run
    times = []
    for i in range(BENCH_FRAMES):
        t0 = time.perf_counter()
        engine.process_frame(rgb, mask)
        elapsed = time.perf_counter() - t0
        times.append(elapsed)
        print(f"    frame {i+1}: {elapsed:.2f}s")

    # Cleanup
    del engine
    torch.mps.empty_cache()

    return {
        "backend": "torch/mps",
        "img_size": img_size,
        "load_time": load_time,
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
    }


def bench_mlx(img_size: int) -> dict:
    """Benchmark MLX inference at a given resolution."""
    try:
        from CorridorKeyModule.backend import create_engine
    except ImportError:
        print("  [MLX] CorridorKey MLX stack not installed — skipping")
        return {"backend": "mlx", "img_size": img_size, "error": "not installed"}

    print(f"\n  [MLX] Loading model at img_size={img_size}...")
    t0 = time.perf_counter()
    try:
        engine = create_engine(backend="mlx", img_size=img_size)
    except (FileNotFoundError, RuntimeError) as err:
        print(f"  [MLX] {err} — skipping")
        return {"backend": "mlx", "img_size": img_size, "error": str(err)}
    load_time = time.perf_counter() - t0
    print(f"  [MLX] Model loaded in {load_time:.1f}s")

    rng = np.random.RandomState(42)
    rgb = (rng.rand(1080, 1920, 3) * 255).astype(np.uint8)
    mask = (rng.rand(1080, 1920) * 255).astype(np.uint8)

    # Warmup
    print(f"  [MLX] Warming up ({WARMUP_FRAMES} frames)...")
    for _ in range(WARMUP_FRAMES):
        engine.process_frame(rgb, mask)

    # Timed run
    times = []
    for i in range(BENCH_FRAMES):
        t0 = time.perf_counter()
        engine.process_frame(rgb, mask)
        elapsed = time.perf_counter() - t0
        times.append(elapsed)
        print(f"    frame {i+1}: {elapsed:.2f}s")

    del engine

    return {
        "backend": "mlx",
        "img_size": img_size,
        "load_time": load_time,
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
    }


def main():
    print("=" * 60)
    print("CorridorKey MPS vs MLX Benchmark")
    print(f"System: Apple M1 Max, 64GB unified memory")
    print(f"Resolutions: {RESOLUTIONS}")
    print(f"Warmup: {WARMUP_FRAMES} frames, Bench: {BENCH_FRAMES} frames")
    print("=" * 60)

    results = []

    for res in RESOLUTIONS:
        print(f"\n{'—' * 50}")
        print(f"Resolution: {res}×{res}")
        print(f"{'—' * 50}")

        results.append(bench_torch_mps(res))
        results.append(bench_mlx(res))

    # Summary table
    print(f"\n{'=' * 70}")
    print(f"{'Backend':<12} {'Res':>6} {'Load':>7} {'Mean':>7} {'Median':>7} {'Min':>7} {'Max':>7}")
    print(f"{'=' * 70}")
    for r in results:
        if "error" in r:
            print(f"{r['backend']:<12} {r['img_size']:>6} {'N/A — ' + r['error']:>40}")
            continue
        print(
            f"{r['backend']:<12} {r['img_size']:>6} "
            f"{r['load_time']:>6.1f}s "
            f"{r['mean']:>6.2f}s "
            f"{r['median']:>6.2f}s "
            f"{r['min']:>6.2f}s "
            f"{r['max']:>6.2f}s"
        )
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()

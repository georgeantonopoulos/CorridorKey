# CorridorKey Desktop

This folder contains the Electron desktop GUI for CorridorKey.

## What This App Does

The desktop app gives you a guided interface for:

- importing a source clip or image sequence into the managed `Projects/` workspace
- validating whether the source is usable
- extracting frames from video automatically
- running the optional GVM hint generator when its weights are installed
- scrubbing through frames to compare source, hint mattes, and results
- monitoring queue progress and backend warnings

## Quick Start

From the repository root:

```bash
cd desktop
npm run dev
```

The Electron app expects the Python environment in the repo root to already be set up. If you have not installed CorridorKey yet, follow the root project instructions first.

## First-Time Setup

Before running inference, make sure the required model weights are installed:

- CorridorKey core checkpoint in `CorridorKeyModule/checkpoints/`
- Optional GVM weights in `gvm_core/weights/`
- Optional VideoMaMa weights if you plan to use VideoMaMa

If GVM is installed but its weights are missing, the app now shows a setup action in the capability banner so you can download the GVM weights from inside the GUI.

## Recommended Workflow

1. Launch the desktop app.
2. Import a `.mp4`, `.mov`, or image-sequence folder.
3. Wait for frame extraction if the source is a video.
4. If you need an automatic hint matte, install GVM weights and run `Run GVM`.
5. Scrub through frames to inspect the source and hint.
6. Run full CorridorKey inference once the clip is ready.

## Where Files Go

- Imported work is normalized under `Projects/`
- Source media is copied into the managed project by default
- Extracted frames, matte hints, and output renders stay inside the project folder

These folders are local workspace output and are intentionally ignored by git.

## More Documentation

For full install instructions, model download details, MLX support, and CLI usage, read the main project documentation:

- [Root README](../README.md)

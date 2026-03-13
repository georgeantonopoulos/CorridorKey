from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import ClipActionRequest, ImportRequest, PreviewRequest
from .state import GuiApiState


def _token_guard(
    authorization: str | None = Header(default=None),
    auth_token: str | None = Query(default=None, alias="authToken"),
) -> None:
    expected = os.environ.get("CORRIDORKEY_GUI_API_TOKEN")
    if not expected:
        return
    token = auth_token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Invalid auth token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    state = GuiApiState()
    app.state.gui = state
    yield
    state.shutdown()


app = FastAPI(title="CorridorKey GUI API", lifespan=lifespan)


def _allowed_origins() -> list[str]:
    configured = os.environ.get("CORRIDORKEY_GUI_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    if origins:
        return origins
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "null",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def gui_state() -> GuiApiState:
    return app.state.gui


@app.get("/health", dependencies=[Depends(_token_guard)])
def health():
    return {"status": "ok"}


@app.get("/capabilities", dependencies=[Depends(_token_guard)])
def capabilities(state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.capabilities()


@app.get("/projects", dependencies=[Depends(_token_guard)])
def list_projects(state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.list_projects()


@app.get("/projects/{project_id}", dependencies=[Depends(_token_guard)])
def get_project(project_id: str, state: Annotated[GuiApiState, Depends(gui_state)]):
    project = state.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Unknown project")
    return project


@app.post("/projects/import", dependencies=[Depends(_token_guard)])
def import_project(payload: ImportRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    project, issues = state.import_sources(payload.paths, payload.copySource)
    return {"project": project, "issues": issues}


@app.post("/projects/{project_id}/scan", dependencies=[Depends(_token_guard)])
def refresh_project(project_id: str, state: Annotated[GuiApiState, Depends(gui_state)]):
    project = state.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Unknown project")
    return project


@app.post("/clips/{clip_id:path}/extract", dependencies=[Depends(_token_guard)])
def extract_clip(clip_id: str, payload: ClipActionRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.queue_clip_action(clip_id, "extract", payload.settings)


@app.post("/clips/{clip_id:path}/gvm", dependencies=[Depends(_token_guard)])
def gvm_clip(clip_id: str, payload: ClipActionRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.queue_clip_action(clip_id, "gvm", payload.settings)


@app.post("/clips/{clip_id:path}/rvm", dependencies=[Depends(_token_guard)])
def rvm_clip(clip_id: str, payload: ClipActionRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.queue_clip_action(clip_id, "rvm", payload.settings)


@app.post("/clips/{clip_id:path}/videomama", dependencies=[Depends(_token_guard)])
def videomama_clip(clip_id: str, payload: ClipActionRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.queue_clip_action(clip_id, "videomama", payload.settings)


@app.post("/clips/{clip_id:path}/inference", dependencies=[Depends(_token_guard)])
def inference_clip(clip_id: str, payload: ClipActionRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.queue_clip_action(clip_id, "inference", payload.settings)


@app.post("/clips/{clip_id:path}/preview-frame", dependencies=[Depends(_token_guard)])
def preview_frame(clip_id: str, payload: PreviewRequest, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.preview_png(clip_id, payload.frameIndex, payload.settings)


@app.post("/jobs/{job_id}/cancel", dependencies=[Depends(_token_guard)])
def cancel_job(job_id: str, state: Annotated[GuiApiState, Depends(gui_state)]):
    state.cancel_job(job_id)
    return {"status": "cancelled"}


@app.post("/downloads/{artifact}", dependencies=[Depends(_token_guard)])
def download_artifact(artifact: str, state: Annotated[GuiApiState, Depends(gui_state)]):
    return state.download_artifact(artifact)


@app.get("/clips/{clip_id:path}/frame", dependencies=[Depends(_token_guard)])
def clip_frame(
    clip_id: str,
    view: str,
    state: Annotated[GuiApiState, Depends(gui_state)],
    frameIndex: int = 0,
):
    image = state.frame_png(clip_id, view, frameIndex)
    return Response(content=image, media_type="image/png")


@app.get("/events", dependencies=[Depends(_token_guard)])
async def events(state: Annotated[GuiApiState, Depends(gui_state)]):
    async def stream():
        while True:
            snapshot = state.snapshot()
            yield f"data: {json.dumps(snapshot.model_dump())}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(stream(), media_type="text/event-stream")

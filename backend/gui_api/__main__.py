from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("CORRIDORKEY_GUI_API_HOST", "127.0.0.1")
    port = int(os.environ.get("CORRIDORKEY_GUI_API_PORT", "8765"))
    uvicorn.run("backend.gui_api.app:app", host=host, port=port, log_level="info", reload=False)


if __name__ == "__main__":
    main()

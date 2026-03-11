import { describe, expect, it, vi } from "vitest";

import { sendBackendStatus, type BackendStatus } from "../src/main/backend-status";

const sampleStatus: BackendStatus = {
  status: "stopped",
  url: null,
  authToken: null,
  message: "Backend stopped."
};

describe("backend-status", () => {
  it("sends status when the window and webContents are alive", () => {
    const send = vi.fn();

    sendBackendStatus(
      {
        isDestroyed: () => false,
        webContents: {
          isDestroyed: () => false,
          send
        }
      },
      sampleStatus
    );

    expect(send).toHaveBeenCalledWith("backend-status", sampleStatus);
  });

  it("does nothing when the window has already been destroyed", () => {
    const send = vi.fn();

    sendBackendStatus(
      {
        isDestroyed: () => true,
        webContents: {
          isDestroyed: () => false,
          send
        }
      },
      sampleStatus
    );

    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing when webContents has already been destroyed", () => {
    const send = vi.fn();

    sendBackendStatus(
      {
        isDestroyed: () => false,
        webContents: {
          isDestroyed: () => true,
          send
        }
      },
      sampleStatus
    );

    expect(send).not.toHaveBeenCalled();
  });
});

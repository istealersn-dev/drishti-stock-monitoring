import { describe, expect, it, vi } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { restartAgent } from "./pm2Restart.js";

function callbackStyle(
  impl: (arguments_: string[]) => void,
): (
  _cmd: string,
  arguments_: string[],
  callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
) => void {
  return (_cmd, arguments_, callback) => {
    try {
      impl(arguments_);
      callback(null, { stdout: "", stderr: "" });
    } catch (e) {
      callback(e as Error);
    }
  };
}

describe("restartAgent", () => {
  it("calls pm2 restart with the drishti-agent process name", async () => {
    let capturedArguments: string[] = [];
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        capturedArguments = arguments_;
      }),
    );

    await restartAgent();

    expect(capturedArguments).toEqual(["restart", "drishti-agent"]);
  });

  it("propagates a failure (e.g. pm2 not found, process missing) to the caller", async () => {
    mockExecFile.mockImplementation(
      callbackStyle(() => {
        throw new Error("process or namespace not found");
      }),
    );

    await expect(restartAgent()).rejects.toThrow("process or namespace not found");
  });
});

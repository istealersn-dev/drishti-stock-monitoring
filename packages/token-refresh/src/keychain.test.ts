import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import {
  CredentialNotFoundError,
  deleteCredential,
  getCredential,
  listConfiguredKeys,
  setCredential,
} from "./keychain.js";

function callbackStyle(
  impl: (arguments_: string[]) => { stdout: string },
): (
  _cmd: string,
  arguments_: string[],
  callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
) => void {
  return (
    _cmd: string,
    arguments_: string[],
    callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
  ) => {
    try {
      const { stdout } = impl(arguments_);
      callback(null, { stdout, stderr: "" });
    } catch (e) {
      callback(e as Error);
    }
  };
}

describe("keychain", () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it("prefixes bare keys with drishti-upstox- when reading", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        expect(arguments_).toContain("drishti-upstox-pin");
        return { stdout: "1234\n" };
      }),
    );
    await expect(getCredential("pin")).resolves.toBe("1234");
  });

  it("does not double-prefix a key that already has the drishti-upstox- prefix", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        expect(arguments_).toContain("drishti-upstox-pin");
        expect(arguments_).not.toContain("drishti-upstox-drishti-upstox-pin");
        return { stdout: "1234\n" };
      }),
    );
    await getCredential("drishti-upstox-pin");
  });

  it("throws CredentialNotFoundError, not a raw error, when the security CLI fails", async () => {
    mockExecFile.mockImplementation(
      callbackStyle(() => {
        throw new Error("security: item not found");
      }),
    );
    await expect(getCredential("missing-key")).rejects.toBeInstanceOf(CredentialNotFoundError);
  });

  it("preserves the real underlying error message instead of a generic one", async () => {
    mockExecFile.mockImplementation(
      callbackStyle(() => {
        throw new Error("SecKeychainItemCopyContent: User interaction is not allowed");
      }),
    );
    await expect(getCredential("pin")).rejects.toThrow(/User interaction is not allowed/);
  });

  it("setCredential calls add-generic-password with -U to overwrite idempotently", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        expect(arguments_[0]).toBe("add-generic-password");
        expect(arguments_).toContain("-U");
        expect(arguments_).toContain("secret-value");
        return { stdout: "" };
      }),
    );
    await setCredential("pin", "secret-value");
  });

  it("deleteCredential calls delete-generic-password", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        expect(arguments_[0]).toBe("delete-generic-password");
        return { stdout: "" };
      }),
    );
    await deleteCredential("pin");
  });

  it("listConfiguredKeys returns only the keys that resolve successfully", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((arguments_) => {
        if (arguments_.includes("drishti-upstox-present")) return { stdout: "value\n" };
        throw new Error("not found");
      }),
    );
    const result = await listConfiguredKeys(["present", "missing"]);
    expect(result).toEqual(["present"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { CredentialNotFoundError, deleteCredential, getCredential, listConfiguredKeys, setCredential } from "./keychain.js";

function callbackStyle(impl: (args: string[]) => { stdout: string }) {
  return (
    _cmd: string,
    args: string[],
    cb: (error: Error | null, result?: { stdout: string; stderr: string }) => void
  ) => {
    try {
      const { stdout } = impl(args);
      cb(null, { stdout, stderr: "" });
    } catch (e) {
      cb(e as Error);
    }
  };
}

describe("keychain", () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it("prefixes bare keys with drishti-upstox- when reading", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((args) => {
        expect(args).toContain("drishti-upstox-pin");
        return { stdout: "1234\n" };
      })
    );
    await expect(getCredential("pin")).resolves.toBe("1234");
  });

  it("does not double-prefix a key that already has the drishti-upstox- prefix", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((args) => {
        expect(args).toContain("drishti-upstox-pin");
        expect(args).not.toContain("drishti-upstox-drishti-upstox-pin");
        return { stdout: "1234\n" };
      })
    );
    await getCredential("drishti-upstox-pin");
  });

  it("throws CredentialNotFoundError, not a raw error, when the security CLI fails", async () => {
    mockExecFile.mockImplementation(
      callbackStyle(() => {
        throw new Error("security: item not found");
      })
    );
    await expect(getCredential("missing-key")).rejects.toBeInstanceOf(CredentialNotFoundError);
  });

  it("setCredential calls add-generic-password with -U to overwrite idempotently", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((args) => {
        expect(args[0]).toBe("add-generic-password");
        expect(args).toContain("-U");
        expect(args).toContain("secret-value");
        return { stdout: "" };
      })
    );
    await setCredential("pin", "secret-value");
  });

  it("deleteCredential calls delete-generic-password", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((args) => {
        expect(args[0]).toBe("delete-generic-password");
        return { stdout: "" };
      })
    );
    await deleteCredential("pin");
  });

  it("listConfiguredKeys returns only the keys that resolve successfully", async () => {
    mockExecFile.mockImplementation(
      callbackStyle((args) => {
        if (args.includes("drishti-upstox-present")) return { stdout: "value\n" };
        throw new Error("not found");
      })
    );
    const result = await listConfiguredKeys(["present", "missing"]);
    expect(result).toEqual(["present"]);
  });
});

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeToken } from "./envWriter.js";

describe("envWriter", () => {
  let directory: string;
  let envPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "token-refresh-test-"));
    envPath = join(directory, ".env.local.test");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("appends both keys when the file does not exist yet", async () => {
    await writeToken(envPath, "abc123", new Date("2026-01-01T00:00:00.000Z"));
    const content = await readFile(envPath, "utf8");
    expect(content).toContain("UPSTOX_ACCESS_TOKEN=abc123");
    expect(content).toContain("UPSTOX_TOKEN_REFRESHED_AT=2026-01-01T00:00:00.000Z");
  });

  it("overwrites the existing token line in place without duplicating it", async () => {
    await writeFile(envPath, "OTHER_KEY=untouched\nUPSTOX_ACCESS_TOKEN=stale\n", "utf8");
    await writeToken(envPath, "fresh", new Date("2026-01-01T00:00:00.000Z"));
    const lines = (await readFile(envPath, "utf8")).split("\n").filter(Boolean);
    expect(lines.filter((l) => l.startsWith("UPSTOX_ACCESS_TOKEN="))).toEqual([
      "UPSTOX_ACCESS_TOKEN=fresh",
    ]);
    expect(lines).toContain("OTHER_KEY=untouched");
  });

  it("leaves every other line untouched", async () => {
    await writeFile(envPath, "A=1\nB=2\nUPSTOX_ACCESS_TOKEN=old\nC=3\n", "utf8");
    await writeToken(envPath, "new", new Date("2026-01-01T00:00:00.000Z"));
    const lines = (await readFile(envPath, "utf8")).split("\n").filter(Boolean);
    expect(lines).toContain("A=1");
    expect(lines).toContain("B=2");
    expect(lines).toContain("C=3");
  });

  it("running twice in a row overwrites cleanly with no growth or duplication", async () => {
    await writeToken(envPath, "first", new Date("2026-01-01T00:00:00.000Z"));
    const firstLineCount = (await readFile(envPath, "utf8")).split("\n").filter(Boolean).length;

    await writeToken(envPath, "second", new Date("2026-01-02T00:00:00.000Z"));
    const content = await readFile(envPath, "utf8");
    const lines = content.split("\n").filter(Boolean);

    expect(lines.length).toBe(firstLineCount);
    expect(lines.filter((l) => l.startsWith("UPSTOX_ACCESS_TOKEN="))).toEqual([
      "UPSTOX_ACCESS_TOKEN=second",
    ]);
    expect(lines.filter((l) => l.startsWith("UPSTOX_TOKEN_REFRESHED_AT="))).toEqual([
      "UPSTOX_TOKEN_REFRESHED_AT=2026-01-02T00:00:00.000Z",
    ]);
  });

  it("replaces every duplicate key line, not just the first, when one somehow exists", async () => {
    await writeFile(
      envPath,
      "UPSTOX_ACCESS_TOKEN=first-stale\nOTHER=1\nUPSTOX_ACCESS_TOKEN=second-stale\n",
      "utf8",
    );
    await writeToken(envPath, "fresh", new Date("2026-01-01T00:00:00.000Z"));
    const lines = (await readFile(envPath, "utf8")).split("\n").filter(Boolean);
    expect(lines.filter((l) => l.startsWith("UPSTOX_ACCESS_TOKEN="))).toEqual([
      "UPSTOX_ACCESS_TOKEN=fresh",
      "UPSTOX_ACCESS_TOKEN=fresh",
    ]);
  });

  it("leaves the original file untouched if the write step fails before rename", async () => {
    await writeFile(envPath, "ORIGINAL=untouched\n", "utf8");
    const badPath = join(directory, "no-such-directory", ".env.local.test");
    await expect(
      writeToken(badPath, "final", new Date("2026-01-01T00:00:00.000Z")),
    ).rejects.toThrow();
    const content = await readFile(envPath, "utf8");
    expect(content).toBe("ORIGINAL=untouched\n");
  });
});

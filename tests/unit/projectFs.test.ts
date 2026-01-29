import { afterEach, describe, expect, it } from "vitest";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  deleteDirIfExists,
  resolveClawdbotStateDir,
  resolveHomePath,
} from "@/lib/projects/fs.server";

let tempDir: string | null = null;

const cleanup = () => {
  if (!tempDir) return;
  fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
};

afterEach(cleanup);

describe("projectFs", () => {
  it("resolvesHomePathVariants", () => {
    expect(resolveHomePath("~")).toBe(os.homedir());
    expect(resolveHomePath("~/foo")).toBe(path.join(os.homedir(), "foo"));
    expect(resolveHomePath("/tmp/x")).toBe("/tmp/x");
  });

  it("resolvesClawdbotStateDirFromEnv", () => {
    const prev = process.env.CLAWDBOT_STATE_DIR;
    process.env.CLAWDBOT_STATE_DIR = "~/state-test";
    try {
      expect(resolveClawdbotStateDir()).toBe(path.join(os.homedir(), "state-test"));
    } finally {
      if (prev === undefined) {
        delete process.env.CLAWDBOT_STATE_DIR;
      } else {
        process.env.CLAWDBOT_STATE_DIR = prev;
      }
    }
  });

  it("deleteDirIfExistsRemovesDirectory", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawdbot-projectfs-"));
    const warnings: string[] = [];
    deleteDirIfExists(tempDir, "Temp dir", warnings);
    expect(fs.existsSync(tempDir)).toBe(false);
    expect(warnings).toEqual([]);
  });
});

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

describe("server getDataDir", () => {
  const originalCwd = process.cwd();
  const originalEnv = process.env.SUDUKU2_DATA_DIR;

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalEnv === undefined) {
      delete process.env.SUDUKU2_DATA_DIR;
    } else {
      process.env.SUDUKU2_DATA_DIR = originalEnv;
    }
  });

  it("honors SUDUKU2_DATA_DIR and creates the directory", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-data-"));
    process.env.SUDUKU2_DATA_DIR = tmp;
    const { getDataDir } = await import("./data-dir");
    expect(getDataDir()).toBe(tmp);
    expect(existsSync(tmp)).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("defaults to <cwd>/data when env is unset", async () => {
    const proj = mkdtempSync(path.join(os.tmpdir(), "suduku2-proj-"));
    delete process.env.SUDUKU2_DATA_DIR;
    process.chdir(proj);
    const { getDataDir } = await import("./data-dir");
    const dir = path.join(proj, "data");
    expect(getDataDir()).toBe(dir);
    expect(existsSync(dir)).toBe(true);
    process.chdir(originalCwd);
    rmSync(proj, { recursive: true, force: true });
  });
});

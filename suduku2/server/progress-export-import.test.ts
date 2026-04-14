import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/generator", () => ({
  generatePuzzle: () => ({
    seed: "mock",
    givens: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)),
    difficultyScore: 11,
    requiredTechniques: [] as string[],
  }),
}));

import { InvalidTokenError } from "./errors";
import {
  MAX_IMPORT_JSON_BYTES,
  USER_PROGRESS_EXPORT_FORMAT,
  exportProgress,
  importProgress,
} from "./progress";
import { userProgressPath } from "./progress";

describe("exportProgress / importProgress", () => {
  const originalEnv = process.env.SUDUKU2_DATA_DIR;
  let tmp: string | undefined;

  afterEach(() => {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = undefined;
    }
    if (originalEnv === undefined) {
      delete process.env.SUDUKU2_DATA_DIR;
    } else {
      process.env.SUDUKU2_DATA_DIR = originalEnv;
    }
  });

  it("export then import round-trips user progress (no token in JSON)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-exim-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");
    const { getProgress, saveProgress } = await import("./progress");

    const { userId } = await register("exUser", "secret12");
    const { token } = await login("exUser", "secret12");

    await saveProgress(token, {
      techniques: { fish: { unlocked: true } },
      practice: { p1: { streak: 1 } },
      endless: { hard: { clearedLevel: 2 } },
      settings: { sound: "off" },
    });

    const before = await getProgress(token);
    const exported = await exportProgress(token);

    expect(exported).not.toMatch(/token/i);
    expect(exported).not.toMatch(/password/i);
    const parsed = JSON.parse(exported) as {
      exportVersion: number;
      format: string;
      progress: { version: number };
    };
    expect(parsed.exportVersion).toBe(1);
    expect(parsed.format).toBe(USER_PROGRESS_EXPORT_FORMAT);
    expect(parsed.progress.version).toBe(1);

    await saveProgress(token, {
      techniques: { fish: { unlocked: false } },
      endless: { hard: { clearedLevel: 0 } },
    });
    expect((await getProgress(token)).techniques.fish).toEqual({ unlocked: false });

    await importProgress(token, exported);

    const after = await getProgress(token);
    expect(after.techniques.fish).toEqual(before.techniques.fish);
    expect(after.practice).toEqual(before.practice);
    expect(after.endless.hard).toEqual(before.endless.hard);
    expect(after.settings).toEqual(before.settings);

    const disk = JSON.parse(readFileSync(userProgressPath(tmp, userId), "utf8")) as { version: number };
    expect(disk.version).toBe(1);
  });

  it("rejects invalid JSON", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-badjson-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");

    await register("j", "secret12");
    const { token } = await login("j", "secret12");

    await expect(importProgress(token, "{")).rejects.toThrow(/parse failed/);
  });

  it("rejects wrong shape or version", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-badshape-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");

    await register("sh", "secret12");
    const { token } = await login("sh", "secret12");

    await expect(importProgress(token, JSON.stringify({}))).rejects.toThrow(/exportVersion/);
    await expect(
      importProgress(
        token,
        JSON.stringify({
          exportVersion: 1,
          format: "wrong-format",
          progress: { version: 1 },
        }),
      ),
    ).rejects.toThrow(/format/);
    await expect(
      importProgress(
        token,
        JSON.stringify({
          exportVersion: 1,
          format: USER_PROGRESS_EXPORT_FORMAT,
          progress: { version: 2, techniques: {}, practice: {}, endless: {} },
        }),
      ),
    ).rejects.toThrow(/progress\.version/);
  });

  it("rejects oversize JSON", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-huge-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");

    await register("h", "secret12");
    const { token } = await login("h", "secret12");

    const huge = `${" ".repeat(MAX_IMPORT_JSON_BYTES + 1)}`;
    await expect(importProgress(token, huge)).rejects.toThrow(/max length/);
  });

  it("rejects invalid token for export and import", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-badtok-ex-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    await expect(exportProgress("not-a-token")).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(importProgress("not-a-token", "{}")).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("import replaces server progress (last-write wins)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-replace-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");
    const { getProgress, saveProgress } = await import("./progress");

    const { userId } = await register("rep", "secret12");
    const { token } = await login("rep", "secret12");

    await saveProgress(token, { techniques: { a: { unlocked: true } } });
    const snap = await exportProgress(token);

    await saveProgress(token, { techniques: { b: { unlocked: true } } });
    const mid = await getProgress(token);
    expect(mid.techniques.a).toEqual({ unlocked: true });
    expect(mid.techniques.b).toEqual({ unlocked: true });

    await importProgress(token, snap);
    const restored = await getProgress(token);
    expect(restored.techniques.a).toEqual({ unlocked: true });
    expect(restored.techniques.b).toBeUndefined();

    expect(existsSync(userProgressPath(tmp, userId))).toBe(true);
  });
});

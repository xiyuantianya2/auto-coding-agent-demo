import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/core";
import { InvalidTokenError } from "./errors";
import { getUserIdFromToken } from "./login";
import { userProgressPath } from "./progress";

function emptyBoardState(): GameState {
  const grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
  const cells = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({})),
  );
  return { grid, cells, mode: "fill" };
}

describe("getProgress / saveProgress", () => {
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

  it("returns default progress and empty global; persists merged patches", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-progress-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");
    const { getProgress, saveProgress } = await import("./progress");

    const { userId } = await register("progressUser", "secret12");
    const { token } = await login("progressUser", "secret12");

    const initial = await getProgress(token);
    expect(initial.endless.entry.clearedLevel).toBe(0);
    expect(initial.global.entry.maxPreparedLevel).toBe(0);
    expect(initial.global.entry.puzzles).toEqual({});

    await saveProgress(token, {
      techniques: { xwing: { unlocked: true } },
      practice: { moduleA: { streak: 2, bestTimeMs: 100 } },
      endless: { normal: { clearedLevel: 3 } },
      settings: { theme: "dark" },
    });

    const after = await getProgress(token);
    expect(after.techniques.xwing).toEqual({ unlocked: true });
    expect(after.practice.moduleA).toEqual({ streak: 2, bestTimeMs: 100 });
    expect(after.endless.normal.clearedLevel).toBe(3);
    expect(after.endless.entry.clearedLevel).toBe(0);
    expect(after.settings).toEqual({ theme: "dark" });

    const file = userProgressPath(tmp, userId);
    expect(existsSync(file)).toBe(true);
    const raw = JSON.parse(readFileSync(file, "utf8")) as { version: number };
    expect(raw.version).toBe(1);
  });

  it("draft round-trips through core serialize format on disk", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-draft-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");
    const { getProgress, saveProgress } = await import("./progress");

    await register("drafter", "secret12");
    const { token } = await login("drafter", "secret12");

    const state = emptyBoardState();
    state.grid[0][0] = 5;
    state.cells[0][0] = { given: 5 };

    await saveProgress(token, { draft: state });

    const loaded = await getProgress(token);
    expect(loaded.draft).toBeDefined();
    const g = loaded.draft as GameState;
    expect(g.grid[0][0]).toBe(5);
    expect(g.cells[0][0].given).toBe(5);

    const disk = JSON.parse(
      readFileSync(userProgressPath(tmp, getUserIdFromToken(token)), "utf8"),
    ) as {
      draft?: { schemaVersion?: number; grid?: number[][] };
    };
    expect(disk.draft?.schemaVersion).toBe(1);
    expect(Array.isArray(disk.draft?.grid)).toBe(true);
  });

  it("rejects invalid token", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-badtok-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { getProgress, saveProgress } = await import("./progress");

    await expect(getProgress("bad-token")).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(saveProgress("bad-token", {})).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("clears draft when patch includes own property draft: undefined", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-cleardraft-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register } = await import("./register");
    const { login } = await import("./login");
    const { getProgress, saveProgress } = await import("./progress");

    await register("cleard", "secret12");
    const { token } = await login("cleard", "secret12");

    await saveProgress(token, { draft: emptyBoardState() });
    expect((await getProgress(token)).draft).toBeDefined();

    await saveProgress(token, { draft: undefined });
    expect((await getProgress(token)).draft).toBeUndefined();
  });
});

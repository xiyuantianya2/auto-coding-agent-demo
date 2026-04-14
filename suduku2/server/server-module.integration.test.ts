/**
 * server-api 模块集成验收（Vitest only，无 Playwright）：
 * - 临时 `SUDUKU2_DATA_DIR` 隔离数据
 * - `@/server` 公开 API 与 `@/lib/core`、`@/lib/generator` 加载顺序（无循环依赖）
 * - 主路径与多用户无尽池上界延伸（mock `generatePuzzle`）
 */

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@/lib/generator", () => ({
  generatePuzzle: (opts: { tier: string }) => mockGenerate(opts),
}));

describe("server module integration (@/server)", () => {
  const originalEnv = process.env.SUDUKU2_DATA_DIR;
  let tmp: string | undefined;

  beforeEach(() => {
    mockGenerate.mockReset();
    mockGenerate.mockImplementation(() => ({
      seed: "mock-seed",
      givens: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)),
      difficultyScore: 42,
      requiredTechniques: [] as string[],
    }));
  });

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

  it("loads @/lib/core, @/lib/generator, then @/server without circular dependency issues", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-srv-cycle-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const core = await import("@/lib/core");
    const generator = await import("@/lib/generator");
    const server = await import("@/server");

    expect(typeof core.serializeGameState).toBe("function");
    expect(typeof generator.generatePuzzle).toBe("function");

    expect(typeof server.register).toBe("function");
    expect(typeof server.login).toBe("function");
    expect(typeof server.getProgress).toBe("function");
    expect(typeof server.saveProgress).toBe("function");
    expect(typeof server.exportProgress).toBe("function");
    expect(typeof server.importProgress).toBe("function");
    expect(typeof server.getDataDir).toBe("function");

    const dir = server.getDataDir();
    expect(path.normalize(dir)).toBe(path.normalize(tmp));
  });

  it("register → login → getProgress (with global) → saveProgress → export → import", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-srv-flow-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const {
      register,
      login,
      getProgress,
      saveProgress,
      exportProgress,
      importProgress,
      getDataDir,
      USER_PROGRESS_EXPORT_FORMAT,
    } = await import("@/server");

    expect(path.normalize(getDataDir())).toBe(path.normalize(tmp));

    const { userId } = await register("flowUser", "secret12", "Nick");
    expect(userId.length).toBeGreaterThan(0);

    const { token } = await login("flowUser", "secret12");
    expect(token.length).toBeGreaterThan(0);

    const first = await getProgress(token);
    expect(first.endless.entry.clearedLevel).toBe(0);
    expect(first.global.entry.maxPreparedLevel).toBe(1);
    expect(first.global.entry.puzzles[1]?.seed).toBe("mock-seed");
    expect(first.global.entry.puzzles[1]).not.toHaveProperty("requiredTechniques");

    await saveProgress(token, {
      techniques: { fish: { unlocked: true } },
      endless: { normal: { clearedLevel: 2 } },
    });

    const mid = await getProgress(token);
    expect(mid.techniques.fish).toEqual({ unlocked: true });
    expect(mid.endless.normal.clearedLevel).toBe(2);
    expect(mid.global.normal.maxPreparedLevel).toBe(3);

    const exported = await exportProgress(token);
    expect(exported).toContain(USER_PROGRESS_EXPORT_FORMAT);
    expect(exported).not.toMatch(/token/i);
    expect(exported).not.toMatch(new RegExp(userId));

    await saveProgress(token, {
      techniques: { fish: { unlocked: false } },
      endless: { normal: { clearedLevel: 0 } },
    });
    expect((await getProgress(token)).techniques.fish).toEqual({ unlocked: false });

    await importProgress(token, exported);
    const restored = await getProgress(token);
    expect(restored.techniques.fish).toEqual({ unlocked: true });
    expect(restored.endless.normal.clearedLevel).toBe(2);
  });

  it("extends endless global maxPreparedLevel when multiple users advance (mocked generator)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-srv-multi-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const { register, login, getProgress, saveProgress } = await import("@/server");

    await register("alpha", "secret12");
    await register("beta", "secret12");

    const { token: tA } = await login("alpha", "secret12");
    const { token: tB } = await login("beta", "secret12");

    await saveProgress(tA, { endless: { entry: { clearedLevel: 2 } } });
    await saveProgress(tB, { endless: { entry: { clearedLevel: 0 } } });

    const g1 = await getProgress(tA);
    expect(g1.global.entry.maxPreparedLevel).toBe(3);
    expect(Object.keys(g1.global.entry.puzzles).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3]);

    await saveProgress(tB, { endless: { entry: { clearedLevel: 4 } } });

    const g2 = await getProgress(tA);
    expect(g2.global.entry.maxPreparedLevel).toBe(5);
    for (let lv = 1; lv <= 5; lv++) {
      expect(g2.global.entry.puzzles[lv]?.difficultyScore).toBe(42);
    }

    expect(mockGenerate).toHaveBeenCalled();
    const calls = mockGenerate.mock.calls;
    for (const [arg] of calls) {
      expect(arg).toMatchObject({ timeoutMs: 5000 });
      expect(typeof (arg as { rng: () => number }).rng).toBe("function");
    }
  });
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DifficultyTier } from "./types";

const mockGenerate = vi.fn();

vi.mock("@/lib/generator", () => ({
  generatePuzzle: (opts: { tier: DifficultyTier }) => mockGenerate(opts),
}));

describe("refreshEndlessGlobalPool", () => {
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

  it("fills levels 1..maxCleared+1 per tier from scanned user files (mocked generator)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-endless-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    const usersDir = path.join(tmp, "users");
    mkdirSync(usersDir, { recursive: true });
    const u1 = path.join(usersDir, "a.json");
    const u2 = path.join(usersDir, "b.json");
    writeFileSync(
      u1,
      JSON.stringify({
        version: 1,
        techniques: {},
        practice: {},
        endless: {
          entry: { clearedLevel: 0 },
          normal: { clearedLevel: 2 },
          hard: { clearedLevel: 0 },
          expert: { clearedLevel: 0 },
        },
      }),
      "utf8",
    );
    writeFileSync(
      u2,
      JSON.stringify({
        version: 1,
        techniques: {},
        practice: {},
        endless: {
          entry: { clearedLevel: 1 },
          normal: { clearedLevel: 1 },
          hard: { clearedLevel: 0 },
          expert: { clearedLevel: 0 },
        },
      }),
      "utf8",
    );

    const { refreshEndlessGlobalPool } = await import("./endless-pool");
    const state = refreshEndlessGlobalPool(tmp);

    expect(state.entry.maxPreparedLevel).toBe(2);
    expect(state.entry.puzzles[1]?.seed).toBe("mock-seed");
    expect(state.entry.puzzles[2]?.difficultyScore).toBe(42);

    expect(state.normal.maxPreparedLevel).toBe(3);
    expect(state.normal.puzzles[1]).toBeDefined();
    expect(state.normal.puzzles[2]).toBeDefined();
    expect(state.normal.puzzles[3]).toBeDefined();

    const globalFile = path.join(tmp, "global", "endless.json");
    expect(existsSync(globalFile)).toBe(true);
    const disk = JSON.parse(readFileSync(globalFile, "utf8")) as {
      version: number;
      state: { entry: { puzzles: Record<string, { seed: string }> } };
    };
    expect(disk.version).toBe(1);
    expect(disk.state.entry.puzzles["1"].seed).toBe("mock-seed");
    expect(Object.keys(disk.state.entry.puzzles["1"])).toEqual(
      expect.arrayContaining(["seed", "givens", "difficultyScore"]),
    );
    expect(disk.state.entry.puzzles["1"]).not.toHaveProperty("requiredTechniques");

    expect(mockGenerate).toHaveBeenCalled();
    const calls = mockGenerate.mock.calls;
    for (const [arg] of calls) {
      expect(arg).toMatchObject({ timeoutMs: 5000 });
      expect(typeof arg.rng).toBe("function");
    }
  });

  it("expert tier: structure smoke when mock returns null (no infinite loop)", async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "suduku2-endless-exp-"));
    process.env.SUDUKU2_DATA_DIR = tmp;

    mkdirSync(path.join(tmp, "users"), { recursive: true });
    writeFileSync(
      path.join(tmp, "users", "solo.json"),
      JSON.stringify({
        version: 1,
        techniques: {},
        practice: {},
        endless: {
          entry: { clearedLevel: 0 },
          normal: { clearedLevel: 0 },
          hard: { clearedLevel: 0 },
          expert: { clearedLevel: 0 },
        },
      }),
      "utf8",
    );

    mockGenerate.mockReturnValue(null);

    const { refreshEndlessGlobalPool } = await import("./endless-pool");
    const state = refreshEndlessGlobalPool(tmp);

    expect(state.expert.maxPreparedLevel).toBe(0);
    expect(state.expert.puzzles).toEqual({});
  });
});

describe("createRngFromSeedKey", () => {
  it("is deterministic for the same key", async () => {
    const { createRngFromSeedKey } = await import("./endless-pool");
    const a = createRngFromSeedKey("k1");
    const b = createRngFromSeedKey("k1");
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

/**
 * integration-qa / task 8：库契约回归（`@/lib/generator`）。
 * 不引入最少提示/最优难度等极限约束；专家档仅验证「墙上时钟预算内返回 null 或合法 PuzzleSpec」。
 */

import { describe, expect, it } from "vitest";

import type { Grid9 } from "@/lib/core";
import { generatePuzzle, verifyUniqueSolution } from "@/lib/generator";

/** 与 `[0, 1)` 一致的确定性 PRNG（固定 seed 便于稳定冒烟）。 */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 常见报章谜题（唯一解），小样本回归。 */
const SAMPLE_UNIQUE: Grid9 = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

function expectValidPuzzleSpec(
  p: NonNullable<ReturnType<typeof generatePuzzle>>,
): void {
  expect(p.seed.length).toBeGreaterThan(0);
  expect(p.givens).toHaveLength(9);
  for (const row of p.givens) {
    expect(row).toHaveLength(9);
  }
  expect(Number.isFinite(p.difficultyScore)).toBe(true);
  expect(Array.isArray(p.requiredTechniques)).toBe(true);
}

describe("integration-qa task 8: generator contract (verifyUniqueSolution / generatePuzzle)", () => {
  it("verifyUniqueSolution: fixed small sample is uniquely solvable", () => {
    expect(verifyUniqueSolution(SAMPLE_UNIQUE)).toBe(true);
  });

  it("verifyUniqueSolution: empty grid is not uniquely solvable", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(verifyUniqueSolution(empty)).toBe(false);
  });

  it("generatePuzzle entry: returns non-null and givens pass verifyUniqueSolution", () => {
    const rng = mulberry32(900_101);
    const p = generatePuzzle({ tier: "entry", rng });
    expect(p).not.toBeNull();
    expectValidPuzzleSpec(p!);
    expect(verifyUniqueSolution(p!.givens)).toBe(true);
  });

  it("generatePuzzle normal: returns non-null and givens pass verifyUniqueSolution", () => {
    const rng = mulberry32(900_102);
    const p = generatePuzzle({ tier: "normal", rng });
    expect(p).not.toBeNull();
    expectValidPuzzleSpec(p!);
    expect(verifyUniqueSolution(p!.givens)).toBe(true);
  });

  it(
    "generatePuzzle hard: timeoutMs caps work; wall clock stays within ~5s (may return null)",
    { timeout: 12_000 },
    () => {
      const rng = mulberry32(900_103);
      const t0 = Date.now();
      const p = generatePuzzle({ tier: "hard", rng, timeoutMs: 5000 });
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(5200);
      if (p !== null) {
        expectValidPuzzleSpec(p);
        expect(verifyUniqueSolution(p.givens)).toBe(true);
      }
    },
  );

  it("generatePuzzle expert: under timeoutMs, returns null or valid spec (bounded search)", () => {
    /**
     * 专家档慢路径：仅依赖 `generatePuzzle` 内部的 `timeoutMs` 墙上预算与尝试上限，
     * 不在测试中放大超时或要求必出题目，避免无界搜索。
     */
    const rng = mulberry32(900_104);
    expect(() =>
      generatePuzzle({ tier: "expert", rng, timeoutMs: 5000 }),
    ).not.toThrow();
    const p = generatePuzzle({ tier: "expert", rng: mulberry32(900_105), timeoutMs: 5000 });
    if (p === null) {
      return;
    }
    expectValidPuzzleSpec(p);
    expect(verifyUniqueSolution(p.givens)).toBe(true);
  });
});

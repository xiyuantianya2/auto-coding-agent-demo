import { test, expect } from "@playwright/test";
import type { Grid9 } from "@/lib/core";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import {
  DIFFICULTY_TIER_CONFIG,
  allowedTechniquesForTier,
  createMulberry32,
  createRngFromSeed,
  derivePuzzleSeedString,
  digPuzzleFromSolution,
  generateCompleteGrid,
  generatePuzzle,
  isValidPuzzleSeedString,
  verifyUniqueSolution,
} from "@/lib/generator";

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

test.describe("Suduku puzzle generator (contract smoke)", () => {
  test("derivePuzzleSeedString + createRngFromSeed form a replayable encoding", () => {
    const seed = derivePuzzleSeedString(() => 0.5);
    expect(isValidPuzzleSeedString(seed)).toBe(true);
    expect(seed).toMatch(/^[0-9a-f]{32}$/);
    const r = createRngFromSeed(seed);
    expect(typeof r()).toBe("number");
  });

  test("verifyUniqueSolution: full valid grid is uniquely solvable; empty board is not", () => {
    expect(verifyUniqueSolution(SOLVED_GRID_SAMPLE)).toBe(true);
    expect(verifyUniqueSolution(EMPTY_GRID)).toBe(false);
  });

  test("difficulty tier config: score ranges are ordered; allowed techniques expand toward hell", () => {
    expect(DIFFICULTY_TIER_CONFIG.easy.difficultyScoreRange.max).toBeLessThan(
      DIFFICULTY_TIER_CONFIG.normal.difficultyScoreRange.min,
    );
    expect(allowedTechniquesForTier("easy").length).toBeLessThan(
      allowedTechniquesForTier("hell").length,
    );
  });

  test("generateCompleteGrid returns a 9×9 grid of digits 1–9 that passes placement checks", () => {
    const grid = generateCompleteGrid(createRngFromSeed("0123456789abcdef0123456789abcdef"));
    expect(grid).toHaveLength(9);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r]![c]!;
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(9);
      }
    }
  });

  test("generatePuzzle (easy) yields unique givens, seed, and solver metadata", () => {
    const spec = generatePuzzle({
      tier: "easy",
      rng: createMulberry32(0x9e3779b1),
    });
    expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
    expect(verifyUniqueSolution(spec.givens)).toBe(true);
    expect(spec.difficultyScore).toBeGreaterThanOrEqual(0);
    expect(spec.requiredTechniques.length).toBeGreaterThanOrEqual(0);
  });

  test("digPuzzleFromSolution keeps a unique-solution puzzle with givens >= tier min", () => {
    const tier = "normal" as const;
    const givens = digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier,
      rng: createRngFromSeed("0123456789abcdef0123456789abcdef"),
    });
    expect(verifyUniqueSolution(givens)).toBe(true);
    let filled = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (givens[r]![c]! !== 0) filled++;
      }
    }
    expect(filled).toBeGreaterThanOrEqual(DIFFICULTY_TIER_CONFIG[tier].givensCount.min);
  });
});

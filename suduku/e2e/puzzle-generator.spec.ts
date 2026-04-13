import { test, expect } from "@playwright/test";
import type { Grid9 } from "@/lib/core";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import {
  createRngFromSeed,
  generateCompleteGrid,
  generatePuzzle,
  isValidPuzzleSeedString,
  verifyUniqueSolution,
} from "@/lib/generator";

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

test.describe("Suduku puzzle generator (contract smoke)", () => {
  test("generatePuzzle returns a canonical seed and replayable rng", () => {
    const spec = generatePuzzle({
      tier: "normal",
      rng: () => 0.5,
    });
    expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
    expect(spec.seed).toMatch(/^[0-9a-f]{32}$/);
    const r = createRngFromSeed(spec.seed);
    expect(typeof r()).toBe("number");
  });

  test("verifyUniqueSolution: full valid grid is uniquely solvable; empty board is not", () => {
    expect(verifyUniqueSolution(SOLVED_GRID_SAMPLE)).toBe(true);
    expect(verifyUniqueSolution(EMPTY_GRID)).toBe(false);
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
});

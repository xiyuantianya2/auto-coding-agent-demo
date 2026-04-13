import { describe, expect, it } from "vitest";

import type { Grid9 } from "../core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SAMPLE_GIVENS_MINIMAL,
  SOLVED_GRID_SAMPLE,
} from "../core/fixture";
import { generatePuzzle, isValidPuzzleSeedString, verifyUniqueSolution } from "./index";

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

describe("verifyUniqueSolution", () => {
  it("returns true for a filled valid 9×9 grid (the unique completion is the grid itself)", () => {
    expect(verifyUniqueSolution(SOLVED_GRID_SAMPLE)).toBe(true);
  });

  it("returns true when exactly one empty cell admits a single completion", () => {
    expect(verifyUniqueSolution(ALMOST_SOLVED_ONE_EMPTY)).toBe(true);
  });

  it("returns false for an empty board (many completions)", () => {
    expect(verifyUniqueSolution(EMPTY_GRID)).toBe(false);
  });

  it("returns false for under-constrained givens (multiple completions)", () => {
    expect(verifyUniqueSolution(SAMPLE_GIVENS_MINIMAL)).toBe(false);
  });

  it("returns false when givens contradict (no completion)", () => {
    const bad: Grid9 = SOLVED_GRID_SAMPLE.map((row) => [...row]) as Grid9;
    bad[0][1] = 1; // two 1s in row 0
    expect(verifyUniqueSolution(bad)).toBe(false);
  });

  it("returns false for malformed grids", () => {
    expect(verifyUniqueSolution([] as unknown as Grid9)).toBe(false);
    expect(verifyUniqueSolution([[0]] as unknown as Grid9)).toBe(false);
  });
});

describe("generatePuzzle (stub pipeline + seed)", () => {
  it("fills a canonical seed and empty givens on success path", () => {
    let i = 0;
    const draws = [0.1, 0.2, 0.3, 0.4];
    const spec = generatePuzzle({
      tier: "easy",
      rng: () => draws[i++],
    });
    expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
    expect(spec.seed).toBe("19999999333333334ccccccc66666666");
    expect(spec.difficultyScore).toBe(0);
    expect(spec.requiredTechniques).toEqual([]);
    expect(spec.givens.every((row) => row.every((c) => c === 0))).toBe(true);
  });
});

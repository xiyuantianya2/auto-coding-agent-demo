import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DifficultyTier, Grid9 } from "../core";
import { createGameStateFromGivens } from "../core";
import { ALMOST_SOLVED_ONE_EMPTY, SOLVED_GRID_SAMPLE } from "../core/fixture";
import {
  computeCandidates,
  findTechniques,
  scoreDifficulty,
} from "../solver";

import { collectSinglesOnlySolvePath, generatePuzzle } from "./generate-puzzle";
import { createMulberry32, derivePuzzleSeedString, isValidPuzzleSeedString } from "./rng";
import { verifyUniqueSolution } from "./verify-unique-solution";

vi.mock("./complete-grid", () => ({
  generateCompleteGrid: vi.fn(),
}));

vi.mock("./dig-puzzle", () => ({
  digPuzzleFromSolution: vi.fn(),
}));

import { digPuzzleFromSolution } from "./dig-puzzle";
import { generateCompleteGrid } from "./complete-grid";

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

/** 与 `find-techniques.test.ts` / `integration.test.ts` 一致的经典题面（快照分档见下方常量注释）。 */
const EASY_CLASSIC_FOR_HELL: Grid9 = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
] as Grid9;

function gridFrom81Line(line: string): Grid9 {
  const g: number[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: number[] = [];
    for (let c = 0; c < 9; c++) {
      const ch = line[r * 9 + c]!;
      row.push(ch === "." ? 0 : Number(ch));
    }
    g.push(row);
  }
  return g as Grid9;
}

/** 快照分约 440 → `normal` 档 */
const HODOKU_X_WING_LINE =
  "9...627....5..3...........67...3.........9...8.2.45..9..35.1.28.4......5.1.......";

/** 教材裸数对题；快照分约 1167 → `hard` 档（首层可含 XY-Wing，与当前 hard 技巧上界一致）。 */
const HODOKU_NAKED_PAIR_LINE =
  "7....9.3....1.5..64..26...9..2.83951..7........56.............31......6......4.1.";

describe("verifyUniqueSolution", () => {
  it("returns true for a filled valid 9×9 grid (the unique completion is the grid itself)", async () => {
    const { SOLVED_GRID_SAMPLE: solved } = await import("../core/fixture");
    expect(verifyUniqueSolution(solved)).toBe(true);
  });

  it("returns true when exactly one empty cell admits a single completion", async () => {
    const { ALMOST_SOLVED_ONE_EMPTY: almost } = await import("../core/fixture");
    expect(verifyUniqueSolution(almost)).toBe(true);
  });

  it("returns false for an empty board (many completions)", () => {
    expect(verifyUniqueSolution(EMPTY_GRID)).toBe(false);
  });

  it("returns false for under-constrained givens (multiple completions)", async () => {
    const { SAMPLE_GIVENS_MINIMAL } = await import("../core/fixture");
    expect(verifyUniqueSolution(SAMPLE_GIVENS_MINIMAL)).toBe(false);
  });

  it("returns false when givens contradict (no completion)", async () => {
    const { SOLVED_GRID_SAMPLE: solved } = await import("../core/fixture");
    const bad: Grid9 = solved.map((row) => [...row]) as Grid9;
    bad[0][1] = 1;
    expect(verifyUniqueSolution(bad)).toBe(false);
  });

  it("returns false for malformed grids", () => {
    expect(verifyUniqueSolution([] as unknown as Grid9)).toBe(false);
    expect(verifyUniqueSolution([[0]] as unknown as Grid9)).toBe(false);
  });
});

describe("generatePuzzle (mocked dig + complete grid)", () => {
  beforeEach(() => {
    process.env.GENERATE_PUZZLE_MAX_ATTEMPTS = "4";
    vi.mocked(generateCompleteGrid).mockReset();
    vi.mocked(digPuzzleFromSolution).mockReset();
    vi.mocked(generateCompleteGrid).mockReturnValue(SOLVED_GRID_SAMPLE);
    vi.mocked(digPuzzleFromSolution).mockImplementation(({ tier }: { tier: DifficultyTier }) => {
      switch (tier) {
        case "easy":
          return ALMOST_SOLVED_ONE_EMPTY.map((row) => [...row]) as Grid9;
        case "normal":
          return gridFrom81Line(HODOKU_X_WING_LINE).map((row) => [...row]) as Grid9;
        case "hard":
          return gridFrom81Line(HODOKU_NAKED_PAIR_LINE).map((row) => [...row]) as Grid9;
        case "hell":
          return EASY_CLASSIC_FOR_HELL.map((row) => [...row]) as Grid9;
        default:
          return EMPTY_GRID;
      }
    });
  });

  const tiers: DifficultyTier[] = ["easy", "normal", "hard", "hell"];

  for (const tier of tiers) {
    it(`tier ${tier}: seed, uniqueness, and solver metadata`, () => {
      const spec = generatePuzzle({ tier, rng: createMulberry32(0xfeedbeef) });
      expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
      expect(verifyUniqueSolution(spec.givens)).toBe(true);

      const state = createGameStateFromGivens(spec.givens);
      if (tier === "easy") {
        const chain = collectSinglesOnlySolvePath(state);
        expect(chain.solved).toBe(true);
        expect(spec.difficultyScore).toBe(scoreDifficulty(state, chain.steps));
        expect(spec.requiredTechniques).toEqual(
          [...new Set(chain.steps.map((s) => s.technique))].sort((a, b) => a.localeCompare(b)),
        );
      } else {
        computeCandidates(state);
        const steps = findTechniques(state);
        expect(spec.difficultyScore).toBe(scoreDifficulty(state, steps));
        expect(spec.requiredTechniques).toEqual(
          [...new Set(steps.map((s) => s.technique))].sort((a, b) => a.localeCompare(b)),
        );
      }
    });
  }
});

describe("derivePuzzleSeedString", () => {
  it("encodes four rng draws as 32 lowercase hex chars (deterministic)", () => {
    let i = 0;
    const draws = [0.1, 0.2, 0.3, 0.4];
    expect(derivePuzzleSeedString(() => draws[i++])).toBe("19999999333333334ccccccc66666666");
    expect(isValidPuzzleSeedString("19999999333333334ccccccc66666666")).toBe(true);
  });
});

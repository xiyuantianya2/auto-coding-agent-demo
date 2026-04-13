import { test, expect } from "@playwright/test";
import { createGameStateFromGivens } from "@/lib/core";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import {
  TECHNIQUE_IDS,
  computeCandidates,
  findTechniques,
  scoreDifficulty,
} from "@/lib/solver";

test.describe("Suduku solver engine (contract smoke)", () => {
  test("exports technique ids, stubs return stable shapes", () => {
    expect(TECHNIQUE_IDS.NAKED_SINGLE).toBe("naked-single");
    expect(TECHNIQUE_IDS.X_WING).toBe("x-wing");

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const grid = computeCandidates(state);
    expect(grid.length).toBe(9);
    expect(grid[0].length).toBe(9);
    expect(grid[0][0]).toBeInstanceOf(Set);

    expect(findTechniques(state)).toEqual([]);
    expect(scoreDifficulty(state, [])).toBe(0);
  });
});

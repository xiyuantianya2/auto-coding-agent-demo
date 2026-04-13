import { test, expect } from "@playwright/test";
import { createGameStateFromGivens } from "@/lib/core";
import type { Grid9 } from "@/lib/core";
import { ALMOST_SOLVED_ONE_EMPTY, SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import {
  ELIMINATION_TECHNIQUE_PIPELINE,
  TECHNIQUE_IDS,
  computeCandidates,
  findTechniques,
  scoreDifficulty,
} from "@/lib/solver";

/** 与单元测试一致：易题含隐单。 */
const EASY_PUZZLE_WITH_HIDDEN: Grid9 = [
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

test.describe("Suduku solver engine (contract smoke)", () => {
  test("exports technique ids, candidates and difficulty stub", () => {
    expect(TECHNIQUE_IDS.NAKED_SINGLE).toBe("naked-single");
    expect(TECHNIQUE_IDS.X_WING).toBe("x-wing");
    expect(TECHNIQUE_IDS.SKYSCRAPER).toBe("skyscraper");
    expect(TECHNIQUE_IDS.XY_WING).toBe("xy-wing");
    expect(ELIMINATION_TECHNIQUE_PIPELINE.some((e) => e.id === TECHNIQUE_IDS.SKYSCRAPER)).toBe(true);
    expect(ELIMINATION_TECHNIQUE_PIPELINE.some((e) => e.id === TECHNIQUE_IDS.XY_WING)).toBe(true);

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const grid = computeCandidates(state);
    expect(grid.length).toBe(9);
    expect(grid[0].length).toBe(9);
    expect(grid[0][0]).toBeInstanceOf(Set);
    expect(grid[0][0].size).toBe(0);

    expect(findTechniques(state)).toEqual([]);
    expect(scoreDifficulty(state, [])).toBe(0);
  });

  test("findTechniques: naked single on almost-solved grid", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const steps = findTechniques(state);
    const naked = steps.filter((s) => s.technique === TECHNIQUE_IDS.NAKED_SINGLE);
    expect(naked.length).toBeGreaterThanOrEqual(1);
    expect(naked[0]!.highlights.length).toBeGreaterThan(0);
  });

  test("findTechniques: hidden single on easy classic puzzle", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    const hidden = steps.filter((s) => s.technique === TECHNIQUE_IDS.HIDDEN_SINGLE);
    expect(hidden.length).toBeGreaterThanOrEqual(1);
    expect(hidden[0]!.highlights.length).toBeGreaterThan(0);
  });

  test("findTechniques: mid-tier pairs and intersections on easy classic puzzle", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    const byId = (id: string) => steps.filter((s) => s.technique === id);
    expect(byId(TECHNIQUE_IDS.HIDDEN_PAIR).length).toBeGreaterThanOrEqual(1);
    expect(byId(TECHNIQUE_IDS.POINTING).length).toBeGreaterThanOrEqual(1);
    expect(byId(TECHNIQUE_IDS.CLAIMING).length).toBeGreaterThanOrEqual(1);
    const withElims = steps.filter((s) => s.eliminations && s.eliminations.length > 0);
    expect(withElims.length).toBeGreaterThanOrEqual(1);
  });
});

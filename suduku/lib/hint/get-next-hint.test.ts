/**
 * 与 `lib/solver/integration.test.ts` 相同的回归盘面，验证 {@link getNextHint} 与
 * `selectNextSolveStep(findTechniques(state))` 的技法一致。
 */
import { describe, expect, it } from "vitest";
import { createGameStateFromGivens, serializeGameState } from "@/lib/core";
import type { Grid9 } from "@/lib/core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SOLVED_GRID_SAMPLE,
} from "@/lib/core/fixture";
import { findTechniques, TECHNIQUE_IDS } from "@/lib/solver";

import { getNextHint } from "./index";
import { selectNextSolveStep } from "./select-next-solve-step";

/** 与 `lib/solver/integration.test.ts` 内联样本一致。 */
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

describe("getNextHint", () => {
  it("full board: null (no empty cells to hint)", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(getNextHint(state)).toBeNull();
  });

  it("matches selectNextSolveStep(findTechniques) on almost-solved naked single", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const steps = findTechniques(state);
    const expected = selectNextSolveStep(steps);
    const hint = getNextHint(state);
    expect(expected).not.toBeNull();
    expect(hint?.technique).toBe(expected!.technique);
    expect(hint?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
    expect(hint?.messageKey).toBe("hint.technique.naked-single");
    expect(hint?.cells.some((p) => p.r === 8 && p.c === 8)).toBe(true);
  });

  it("matches selectNextSolveStep on easy classic puzzle (first teachable step)", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    const expected = selectNextSolveStep(steps);
    const hint = getNextHint(state);
    expect(expected).not.toBeNull();
    expect(hint?.technique).toBe(expected!.technique);
    expect(hint?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
  });

  it("CandidatesComputationError (obvious conflict): null", () => {
    const bad: Grid9 = structuredClone(SOLVED_GRID_SAMPLE);
    bad[0][1] = bad[0][0];
    const state = createGameStateFromGivens(bad);
    expect(getNextHint(state)).toBeNull();
  });

  it("does not mutate GameState", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const before = serializeGameState(state);
    getNextHint(state);
    expect(serializeGameState(state)).toBe(before);
  });
});

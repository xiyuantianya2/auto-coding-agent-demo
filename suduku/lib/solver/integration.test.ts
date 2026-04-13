/**
 * 集成级回归：通过本目录 {@link ./index}（与 `@/lib/solver` 同表面）串联候选、技巧与打分；
 * 仅依赖 `lib/core` 公开入口（工厂、克隆、合法落子与胜负），不引用 generator / hint 等未来包。
 */
import { describe, expect, it } from "vitest";
import {
  cloneGameState,
  createGameStateFromGivens,
  isLegalSetValue,
  isWinningState,
} from "../core";
import type { GameState, Grid9 } from "../core";
import {
  TECHNIQUE_IDS,
  computeCandidates,
  findTechniques,
  scoreDifficulty,
} from "./index";

/** 与 `lib/core/fixture` 中样本一致（内联以避免依赖非入口路径）。 */
const SOLVED_GRID_SAMPLE: Grid9 = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
] as Grid9;

const ALMOST_SOLVED_ONE_EMPTY: Grid9 = SOLVED_GRID_SAMPLE.map((row, r) =>
  r === 8 ? row.map((n, c) => (c === 8 ? 0 : n)) : [...row],
) as Grid9;

/** 经典易题：与 `find-techniques.test.ts` / E2E 共用同一回归盘面。 */
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

function applyPlayerDigit(state: GameState, r: number, c: number, n: number): GameState {
  expect(isLegalSetValue(state, r, c, n)).toBe(true);
  const next = cloneGameState(state);
  next.cells[r][c] = { value: n };
  return next;
}

describe("solver integration (public barrel + core factories)", () => {
  it("solved grid: empty techniques and zero difficulty score", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const cand = computeCandidates(state);
    expect(cand[0][0].size).toBe(0);
    const steps = findTechniques(state);
    expect(steps).toEqual([]);
    expect(scoreDifficulty(state, [])).toBe(0);
  });

  it("multi-step: almost-solved → naked single → winning state clears techniques", () => {
    const start = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const cand0 = computeCandidates(start);
    expect(cand0[8][8]).toEqual(new Set([8]));

    const steps0 = findTechniques(start);
    expect(steps0).toHaveLength(1);
    expect(steps0[0]).toMatchObject({
      technique: TECHNIQUE_IDS.NAKED_SINGLE,
      highlights: expect.arrayContaining([
        { kind: "cell", ref: { r: 8, c: 8 } },
        { kind: "candidate", ref: { r: 8, c: 8, digit: 8 } },
      ]),
    });
    expect(scoreDifficulty(start, steps0)).toBe(21);

    const filled = applyPlayerDigit(start, 8, 8, 8);
    expect(isWinningState(filled)).toBe(true);
    expect(findTechniques(filled)).toEqual([]);
    expect(scoreDifficulty(filled, [])).toBe(0);
  });

  it("regression: easy classic puzzle — step count, score, technique set, first step", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const cand = computeCandidates(state);
    expect(cand.length).toBe(9);
    expect(cand[0].length).toBe(9);

    const steps = findTechniques(state);
    expect(steps).toHaveLength(47);
    expect(scoreDifficulty(state, steps)).toBe(2336);
    expect(steps[0]?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);

    const uniq = [...new Set(steps.map((s) => s.technique))].sort();
    expect(uniq).toEqual([
      TECHNIQUE_IDS.CLAIMING,
      TECHNIQUE_IDS.HIDDEN_PAIR,
      TECHNIQUE_IDS.HIDDEN_SINGLE,
      TECHNIQUE_IDS.NAKED_SINGLE,
      TECHNIQUE_IDS.POINTING,
    ]);
  });
});

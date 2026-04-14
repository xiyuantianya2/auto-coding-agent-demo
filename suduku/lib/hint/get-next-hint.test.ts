/**
 * 端到端覆盖 {@link getNextHint}：合法盘面、技法边界与只读不变式。
 *
 * 「仅隐单」样例：HoDoKu 裸数对题沿引擎 `findTechniques` 输出顺序反复取**首条裸单**并填入，
 * 第 8 步后首层观测无裸单、仅有隐单（与 `findTechniques` 稳定顺序绑定；勿改格序）。
 */
import { describe, expect, it } from "vitest";
import {
  cloneGameState,
  createGameStateFromGivens,
  serializeGameState,
} from "@/lib/core";
import type { GameState, Grid9 } from "@/lib/core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SOLVED_GRID_SAMPLE,
} from "@/lib/core/fixture";
import {
  findTechniques,
  TECHNIQUE_IDS,
  type SolveStep,
} from "@/lib/solver";

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

/** HoDoKu 教材「Naked Pair」原题（与 `find-techniques.test.ts` 同源）。 */
const HODOKU_NAKED_PAIR_LINE =
  "7....9.3....1.5..64..26...9..2.83951..7........56.............31......6......4.1.";

/**
 * HoDoKu 题从开局连填 8 步「列表中首条裸单」后的给定网；
 * 此时 `findTechniques` 无裸单、有隐单，且盘面未解（见模块注释）。
 */
const HODOKU_AFTER_8_NAKED_HIDDEN_ONLY_LAYER: Grid9 = [
  [7, 0, 0, 8, 4, 9, 0, 3, 0],
  [0, 0, 0, 1, 3, 5, 0, 0, 6],
  [4, 0, 0, 2, 6, 7, 0, 8, 9],
  [6, 4, 2, 7, 8, 3, 9, 5, 1],
  [0, 0, 7, 0, 0, 0, 0, 0, 0],
  [0, 0, 5, 6, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 3],
  [1, 0, 0, 0, 0, 0, 0, 6, 0],
  [0, 0, 0, 0, 0, 4, 0, 1, 0],
] as Grid9;

/** 无**明显**重复但 (0,8) 无合法候选（`compute-candidates.test.ts`）。 */
const EMPTY_CANDIDATES_NO_OBVIOUS_DUP: Grid9 = (() => {
  const g: Grid9 = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
  g[0] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  g[1][8] = 9;
  return g;
})();

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

function applySinglePlacementStep(state: GameState, step: SolveStep): GameState {
  const cellH = step.highlights.find((h) => h.kind === "cell");
  const candH = step.highlights.find((h) => h.kind === "candidate");
  if (!cellH || cellH.kind !== "cell" || !candH || candH.kind !== "candidate") {
    throw new Error("expected cell + candidate highlights");
  }
  const { r, c } = cellH.ref;
  const { digit } = candH.ref;
  const next = cloneGameState(state);
  next.cells[r][c] = { value: digit };
  return next;
}

/**
 * 反复应用 `selectNextSolveStep` 为裸单或隐单时对应的填入，直到下一步为**非单数字**技巧。
 * HoDoKu 裸数对题在此路径上会停在首层「裸数对」之前（见回归断言）。
 */
function saturateSinglesUntilElimination(initial: Grid9): GameState {
  let state = createGameStateFromGivens(initial);
  for (let i = 0; i < 800; i++) {
    const steps = findTechniques(state);
    const next = selectNextSolveStep(steps);
    if (!next) return state;
    if (
      next.technique !== TECHNIQUE_IDS.NAKED_SINGLE &&
      next.technique !== TECHNIQUE_IDS.HIDDEN_SINGLE
    ) {
      return state;
    }
    state = applySinglePlacementStep(state, next);
  }
  throw new Error("saturateSinglesUntilElimination: exceeded iteration budget");
}

describe("getNextHint", () => {
  it("full board: null (no empty cells to hint)", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(getNextHint(state)).toBeNull();
  });

  it("naked single: cells, highlightCandidates, technique, messageKey", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const steps = findTechniques(state);
    const expected = selectNextSolveStep(steps);
    const hint = getNextHint(state);
    expect(expected).not.toBeNull();
    expect(hint?.technique).toBe(expected!.technique);
    expect(hint?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
    expect(hint?.messageKey).toBe("hint.technique.naked-single");
    expect(hint?.cells.some((p) => p.r === 8 && p.c === 8)).toBe(true);
    expect(hint?.highlightCandidates).toEqual([{ r: 8, c: 8, digits: [8] }]);
  });

  it("matches selectNextSolveStep(findTechniques) on easy classic puzzle (first teachable step)", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const steps = findTechniques(state);
    const expected = selectNextSolveStep(steps);
    const hint = getNextHint(state);
    expect(expected).not.toBeNull();
    expect(hint?.technique).toBe(expected!.technique);
    expect(hint?.technique).toBe(TECHNIQUE_IDS.NAKED_SINGLE);
  });

  it("hidden single only in first layer: after 8 naked placements on Hodoku grid", () => {
    const state = createGameStateFromGivens(HODOKU_AFTER_8_NAKED_HIDDEN_ONLY_LAYER);
    const steps = findTechniques(state);
    expect(steps.some((s) => s.technique === TECHNIQUE_IDS.NAKED_SINGLE)).toBe(false);
    expect(steps.some((s) => s.technique === TECHNIQUE_IDS.HIDDEN_SINGLE)).toBe(true);

    const expected = selectNextSolveStep(steps);
    const hint = getNextHint(state);
    expect(expected?.technique).toBe(TECHNIQUE_IDS.HIDDEN_SINGLE);
    expect(hint?.technique).toBe(TECHNIQUE_IDS.HIDDEN_SINGLE);
    expect(hint?.messageKey).toBe("hint.technique.hidden-single");
    expect(hint?.cells.length).toBeGreaterThan(0);
    expect(hint?.highlightCandidates?.length).toBeGreaterThan(0);
  });

  it("elimination technique only: Hodoku after exhausting singles, next is naked-pair", () => {
    const state = saturateSinglesUntilElimination(gridFrom81Line(HODOKU_NAKED_PAIR_LINE));
    const steps = findTechniques(state);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.technique === TECHNIQUE_IDS.NAKED_SINGLE)).toBe(false);
    expect(steps.some((s) => s.technique === TECHNIQUE_IDS.HIDDEN_SINGLE)).toBe(false);

    const hint = getNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe(TECHNIQUE_IDS.NAKED_PAIR);
    expect(hint!.messageKey).toBe("hint.technique.naked-pair");
    expect(hint!.cells.length + (hint!.highlightCandidates?.length ?? 0)).toBeGreaterThan(0);
  });

  it("CandidatesComputationError (obvious conflict): null", () => {
    const bad: Grid9 = structuredClone(SOLVED_GRID_SAMPLE);
    bad[0][1] = bad[0][0];
    const state = createGameStateFromGivens(bad);
    expect(getNextHint(state)).toBeNull();
  });

  it("CandidatesComputationError (empty cell candidates): null", () => {
    const state = createGameStateFromGivens(EMPTY_CANDIDATES_NO_OBVIOUS_DUP);
    expect(getNextHint(state)).toBeNull();
  });

  it("does not mutate GameState (serialize stable; repeated calls)", () => {
    const state = createGameStateFromGivens(EASY_PUZZLE_WITH_HIDDEN);
    const before = serializeGameState(state);
    for (let k = 0; k < 12; k++) {
      getNextHint(state);
    }
    expect(serializeGameState(state)).toBe(before);
  });
});

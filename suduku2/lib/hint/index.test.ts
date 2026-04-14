import { describe, expect, it } from "vitest";

import { EMPTY_CELL, type CellState, type GameState, type Grid9 } from "@/lib/core";

import { getNextHint, TechniqueIds, type HintResult } from "./index";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

/** 与 `find-applicable-steps.test` 相同终盘；擦去一格后出现裸单。 */
const COMPLETE_SOLUTION: Grid9 = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function makeState(grid: Grid9, cells: CellState[][]): GameState {
  return { grid, cells, mode: "fill" };
}

describe("hint-system skeleton", () => {
  it("re-exports solver TechniqueIds unchanged", () => {
    expect(TechniqueIds.UniqueCandidate).toBe("unique-candidate");
  });

  it("getNextHint returns a non-null hint with a non-empty technique id on a solvable mid-game fixture", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) {
          continue;
        }
        grid[r][c] = COMPLETE_SOLUTION[r][c]!;
        cells[r][c] = { given: COMPLETE_SOLUTION[r][c]! };
      }
    }
    const state = makeState(grid, cells);
    const hint = getNextHint(state);
    expect(hint).not.toBeNull();
    expect(typeof hint!.technique).toBe("string");
    expect(hint!.technique.length).toBeGreaterThan(0);
  });

  it("getNextHint returns null for a completed valid board", () => {
    const grid = COMPLETE_SOLUTION.map((row) => [...row]);
    const cells: CellState[][] = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c): CellState => ({ given: grid[r]![c]! })),
    );
    const state = makeState(grid, cells);
    expect(getNextHint(state)).toBeNull();
  });

  it("HintResult shape is assignable for typed consumers", () => {
    const sample: HintResult = {
      technique: TechniqueIds.HiddenSingle,
      cells: [{ r: 0, c: 1 }],
      highlightCandidates: [
        { r: 2, c: 3, digits: [4, 5], eliminate: [5] },
      ],
      messageKey: "solver.hidden-single.row",
    };
    expect(sample.technique).toBe(TechniqueIds.HiddenSingle);
  });
});

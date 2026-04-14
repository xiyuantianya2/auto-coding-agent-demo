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

describe("hint-system skeleton", () => {
  it("re-exports solver TechniqueIds unchanged", () => {
    expect(TechniqueIds.UniqueCandidate).toBe("unique-candidate");
  });

  it("getNextHint placeholder returns null", () => {
    const state: GameState = {
      grid: makeEmptyGrid(),
      cells: makeEmptyCells(),
      mode: "fill",
    };
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

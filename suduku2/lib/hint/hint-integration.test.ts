import { describe, expect, it } from "vitest";

import {
  cloneGameState,
  deserializeGameState,
  EMPTY_CELL,
  serializeGameState,
  type CellState,
  type GameState,
  type Grid9,
} from "@/lib/core";

import { getNextHint, type HintResult } from "./index";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

/** 与 `index.test` 相同：擦去一格后出现裸单，便于快速求解路径。 */
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

function makeSolvableMidGame(): GameState {
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
  return { grid, cells, mode: "fill" };
}

function hintKey(h: HintResult | null): string {
  return JSON.stringify(h);
}

describe("hint-system integration", () => {
  it("multiple getNextHint calls do not mutate the passed GameState", () => {
    const state = makeSolvableMidGame();
    const before = serializeGameState(state);
    for (let i = 0; i < 8; i++) {
      getNextHint(state);
    }
    expect(serializeGameState(state)).toBe(before);
  });

  it("after cloneGameState, repeated getNextHint on the clone leaves the original snapshot unchanged", () => {
    const original = makeSolvableMidGame();
    const snapshot = serializeGameState(original);
    const working = cloneGameState(original);
    for (let i = 0; i < 8; i++) {
      getNextHint(working);
    }
    expect(serializeGameState(original)).toBe(snapshot);
  });

  it("serializeGameState / deserializeGameState round-trip yields the same getNextHint result", () => {
    const state = makeSolvableMidGame();
    const hintBefore = getNextHint(state);
    const restored = deserializeGameState(serializeGameState(state));
    const hintAfter = getNextHint(restored);
    expect(hintKey(hintAfter)).toBe(hintKey(hintBefore));
  });
});

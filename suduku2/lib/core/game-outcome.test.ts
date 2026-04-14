import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import {
  findFirstRuleConflictPair,
  hasRuleConflict,
  isBoardFilled,
  isVictory,
  listRuleConflictPairs,
} from "./game-outcome";
import type { CellState, GameState, Grid9 } from "./types";

/** 合法完整解答（标准 9×9 数独）。 */
const VALID_COMPLETE: number[][] = [
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

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function stateFromDigitGrid(rows: number[][], useGiven: boolean): GameState {
  const grid: Grid9 = rows.map((row) => [...row]);
  const cells: CellState[][] = rows.map((row) =>
    row.map((n) => (useGiven ? { given: n } : { value: n })),
  );
  return { grid, cells, mode: "fill" };
}

describe("isBoardFilled", () => {
  it("returns true for a fully filled valid solution grid", () => {
    const state = stateFromDigitGrid(VALID_COMPLETE, false);
    expect(isBoardFilled(state)).toBe(true);
  });

  it("returns false when any cell has no effective digit", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[4][4] = EMPTY_CELL;
    const grid = rows.map((row) => [...row]);
    const cells: CellState[][] = rows.map((row, r) =>
      row.map((n, c) =>
        r === 4 && c === 4 ? {} : ({ value: n } as CellState),
      ),
    );
    const state: GameState = { grid, cells, mode: "fill" };
    expect(isBoardFilled(state)).toBe(false);
  });

  it("returns false when only notes exist and no given/value", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cells[r][c] = { notes: new Set([1, 2, 3]) };
      }
    }
    const state: GameState = { grid, cells, mode: "notes" };
    expect(isBoardFilled(state)).toBe(false);
  });
});

describe("hasRuleConflict / findFirstRuleConflictPair / listRuleConflictPairs", () => {
  it("detects no conflict on a valid complete grid", () => {
    const state = stateFromDigitGrid(VALID_COMPLETE, true);
    expect(hasRuleConflict(state)).toBe(false);
    expect(findFirstRuleConflictPair(state)).toBeNull();
    expect(listRuleConflictPairs(state)).toEqual([]);
  });

  it("detects row duplicate", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[0][1] = rows[0][0];
    const state = stateFromDigitGrid(rows, false);
    expect(hasRuleConflict(state)).toBe(true);
    const first = findFirstRuleConflictPair(state);
    expect(first).not.toBeNull();
    expect(first!.digit).toBe(rows[0][0]);
    expect(first!.r1).toBe(0);
    expect(first!.r2).toBe(0);
    const list = listRuleConflictPairs(state);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((p) => p.r1 === 0 && p.r2 === 0)).toBe(true);
  });

  it("detects column duplicate", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[2][3] = rows[0][3];
    const state = stateFromDigitGrid(rows, false);
    expect(hasRuleConflict(state)).toBe(true);
    const first = findFirstRuleConflictPair(state);
    expect(first).not.toBeNull();
    expect(first!.c1).toBe(first!.c2);
  });

  it("detects box duplicate", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[1][1] = rows[0][0];
    const state = stateFromDigitGrid(rows, false);
    expect(hasRuleConflict(state)).toBe(true);
  });

  it("does not flag same digit in different units as conflict", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 5;
    grid[4][4] = 5;
    cells[0][0] = { value: 5 };
    cells[4][4] = { value: 5 };
    const state: GameState = { grid, cells, mode: "fill" };
    expect(hasRuleConflict(state)).toBe(false);
  });

  it("lists multiple pairs for triple duplicate in one row", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 7;
    grid[0][3] = 7;
    grid[0][6] = 7;
    cells[0][0] = { value: 7 };
    cells[0][3] = { value: 7 };
    cells[0][6] = { value: 7 };
    const state: GameState = { grid, cells, mode: "fill" };
    const list = listRuleConflictPairs(state);
    expect(list.length).toBe(3);
  });
});

describe("isVictory", () => {
  it("is true for filled valid complete grid", () => {
    const state = stateFromDigitGrid(VALID_COMPLETE, false);
    expect(isVictory(state)).toBe(true);
  });

  it("is false when not filled", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[8][8] = EMPTY_CELL;
    const grid = rows.map((row) => [...row]);
    const cells: CellState[][] = rows.map((row, r) =>
      row.map((n, c) =>
        r === 8 && c === 8 ? {} : ({ value: n } as CellState),
      ),
    );
    const state: GameState = { grid, cells, mode: "fill" };
    expect(isVictory(state)).toBe(false);
  });

  it("is false when filled but has conflict", () => {
    const rows = VALID_COMPLETE.map((row) => [...row]);
    rows[0][2] = rows[0][0];
    const state = stateFromDigitGrid(rows, false);
    expect(isBoardFilled(state)).toBe(true);
    expect(isVictory(state)).toBe(false);
  });

  it("is false for notes-only board", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[0][0] = { notes: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]) };
    const state: GameState = { grid, cells, mode: "notes" };
    expect(isVictory(state)).toBe(false);
  });
});

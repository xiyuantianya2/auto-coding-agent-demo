import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import {
  getEffectiveCellDigit,
  getEffectiveDigitAt,
  getUniqueValidPlacementDigit,
  isValidPlacement,
} from "./placement";
import type { CellState, GameState, Grid9 } from "./types";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function makeState(grid: Grid9, cells: CellState[][]): GameState {
  return { grid, cells, mode: "fill" };
}

describe("getEffectiveCellDigit", () => {
  it("returns given when present", () => {
    expect(getEffectiveCellDigit({ given: 4 })).toBe(4);
  });

  it("prefers given over value", () => {
    expect(getEffectiveCellDigit({ given: 7, value: 3 })).toBe(7);
  });

  it("returns value when given is absent", () => {
    expect(getEffectiveCellDigit({ value: 6 })).toBe(6);
  });

  it("returns empty when neither given nor value is a filled digit", () => {
    expect(getEffectiveCellDigit({})).toBe(EMPTY_CELL);
    expect(getEffectiveCellDigit({ notes: new Set([1, 2]) })).toBe(EMPTY_CELL);
  });

  it("ignores invalid given/value for effective digit", () => {
    expect(getEffectiveCellDigit({ given: 0 as unknown as number })).toBe(EMPTY_CELL);
    expect(getEffectiveCellDigit({ given: 10 as unknown as number })).toBe(EMPTY_CELL);
    expect(getEffectiveCellDigit({ value: 0 as unknown as number })).toBe(EMPTY_CELL);
  });
});

describe("getEffectiveDigitAt", () => {
  it("reads cell at coordinate", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[2][5] = { given: 9 };
    grid[2][5] = 9;
    const state = makeState(grid, cells);
    expect(getEffectiveDigitAt(state, 2, 5)).toBe(9);
  });

  it("returns empty for out-of-bounds coordinates", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    expect(getEffectiveDigitAt(state, -1, 0)).toBe(EMPTY_CELL);
    expect(getEffectiveDigitAt(state, 0, 9)).toBe(EMPTY_CELL);
  });
});

describe("isValidPlacement", () => {
  it("returns true for legal placement on empty board", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    expect(isValidPlacement(state, 0, 0, 5)).toBe(true);
  });

  it("detects row conflict", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][1] = 3;
    cells[0][1] = { value: 3 };
    const state = makeState(grid, cells);
    expect(isValidPlacement(state, 0, 0, 3)).toBe(false);
    expect(isValidPlacement(state, 0, 0, 7)).toBe(true);
  });

  it("detects column conflict", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[4][3] = 8;
    cells[4][3] = { given: 8 };
    const state = makeState(grid, cells);
    expect(isValidPlacement(state, 2, 3, 8)).toBe(false);
    expect(isValidPlacement(state, 2, 3, 1)).toBe(true);
  });

  it("detects box conflict", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 2;
    cells[0][0] = { value: 2 };
    const state = makeState(grid, cells);
    expect(isValidPlacement(state, 1, 1, 2)).toBe(false);
    expect(isValidPlacement(state, 1, 1, 6)).toBe(true);
  });

  it("ignores the target cell when checking conflicts", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[4][4] = 5;
    cells[4][4] = { value: 5 };
    const state = makeState(grid, cells);
    expect(isValidPlacement(state, 4, 4, 5)).toBe(true);
  });

  it("returns false for invalid coordinates", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    expect(isValidPlacement(state, -1, 0, 1)).toBe(false);
    expect(isValidPlacement(state, 0, 9, 1)).toBe(false);
  });

  it("returns false for n outside 1–9", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    expect(isValidPlacement(state, 0, 0, 0)).toBe(false);
    expect(isValidPlacement(state, 0, 0, 10)).toBe(false);
    expect(isValidPlacement(state, 0, 0, 1.5)).toBe(false);
  });

  it("uses given digit for conflict checks", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[6][6] = 1;
    cells[6][6] = { given: 1 };
    const state = makeState(grid, cells);
    expect(isValidPlacement(state, 6, 7, 1)).toBe(false);
  });
});

describe("getUniqueValidPlacementDigit", () => {
  it("returns null when multiple digits are valid on an empty cell", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    expect(getUniqueValidPlacementDigit(state, 0, 0)).toBeNull();
  });

  it("returns null when no digit is valid (row/col block all 1–9)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let c = 1; c <= 8; c++) {
      grid[0][c] = c;
      cells[0][c] = { value: c };
    }
    grid[1][0] = 9;
    cells[1][0] = { value: 9 };
    const state = makeState(grid, cells);
    expect(getUniqueValidPlacementDigit(state, 0, 0)).toBeNull();
  });

  it("returns the only digit when the row forces a single value in the last free cell", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let c = 0; c < 8; c++) {
      const d = c + 1;
      grid[0][c] = d;
      cells[0][c] = { value: d };
    }
    const state = makeState(grid, cells);
    expect(getUniqueValidPlacementDigit(state, 0, 8)).toBe(9);
  });

  it("returns null for a filled cell", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[3][3] = 4;
    cells[3][3] = { value: 4 };
    const state = makeState(grid, cells);
    expect(getUniqueValidPlacementDigit(state, 3, 3)).toBeNull();
  });
});

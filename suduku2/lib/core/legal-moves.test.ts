import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import { isLegalClearCell, isLegalFill, isLegalToggleNote } from "./legal-moves";
import type { CellState, GameState, Grid9 } from "./types";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function makeState(grid: Grid9, cells: CellState[][], mode: GameState["mode"]): GameState {
  return { grid, cells, mode };
}

describe("isLegalFill", () => {
  it("allows legal fill on empty cell in fill mode", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "fill");
    expect(isLegalFill(state, 0, 0, 5)).toBe(true);
  });

  it("rejects fill on given cell", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[1][1] = 9;
    cells[1][1] = { given: 9 };
    const state = makeState(grid, cells, "fill");
    expect(isLegalFill(state, 1, 1, 9)).toBe(false);
    expect(isLegalFill(state, 1, 1, 1)).toBe(false);
  });

  it("rejects fill when placement conflicts with row", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][1] = 3;
    cells[0][1] = { value: 3 };
    const state = makeState(grid, cells, "fill");
    expect(isLegalFill(state, 0, 0, 3)).toBe(false);
  });

  it("rejects fill in notes mode", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "notes");
    expect(isLegalFill(state, 0, 0, 1)).toBe(false);
  });

  it("rejects invalid n or coordinates", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "fill");
    expect(isLegalFill(state, 0, 0, 0)).toBe(false);
    expect(isLegalFill(state, -1, 0, 1)).toBe(false);
  });

  it("rejects fill when cell state breaks invariants", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[2][2] = { value: 4, notes: new Set([1]) };
    const state = makeState(grid, cells, "fill");
    expect(isLegalFill(state, 2, 2, 6)).toBe(false);
  });

  it("allows replacing player value when new placement is valid", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[4][4] = 2;
    cells[4][4] = { value: 2 };
    const state = makeState(grid, cells, "fill");
    expect(isLegalFill(state, 4, 4, 5)).toBe(true);
  });
});

describe("isLegalToggleNote", () => {
  it("allows toggle on empty non-given cell in notes mode", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "notes");
    expect(isLegalToggleNote(state, 3, 4, 7)).toBe(true);
  });

  it("rejects toggle on given cell", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 1;
    cells[0][0] = { given: 1 };
    const state = makeState(grid, cells, "notes");
    expect(isLegalToggleNote(state, 0, 0, 2)).toBe(false);
  });

  it("rejects toggle when cell has player value (fill vs notes mutual exclusion)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[5][5] = 8;
    cells[5][5] = { value: 8 };
    const state = makeState(grid, cells, "notes");
    expect(isLegalToggleNote(state, 5, 5, 1)).toBe(false);
  });

  it("rejects toggle in fill mode", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "fill");
    expect(isLegalToggleNote(state, 0, 0, 2)).toBe(false);
  });

  it("rejects invalid digit or coordinates", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "notes");
    expect(isLegalToggleNote(state, 0, 0, 10)).toBe(false);
    expect(isLegalToggleNote(state, 0, 9, 1)).toBe(false);
  });

  it("rejects when notes/value invariant is broken", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[1][2] = { notes: new Set([11 as unknown as number]) };
    const state = makeState(grid, cells, "notes");
    expect(isLegalToggleNote(state, 1, 2, 3)).toBe(false);
  });
});

describe("isLegalClearCell", () => {
  it("allows clearing non-given cell with value or notes", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[2][3] = 6;
    cells[2][3] = { value: 6 };
    expect(isLegalClearCell(makeState(grid, cells, "fill"), 2, 3)).toBe(true);

    const grid2 = makeEmptyGrid();
    const cells2 = makeEmptyCells();
    cells2[4][4] = { notes: new Set([1, 2]) };
    expect(isLegalClearCell(makeState(grid2, cells2, "notes"), 4, 4)).toBe(true);
  });

  it("rejects clearing given cell", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 5;
    cells[0][0] = { given: 5 };
    expect(isLegalClearCell(makeState(grid, cells, "fill"), 0, 0)).toBe(false);
  });

  it("allows idempotent clear on already empty non-given cell", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "fill");
    expect(isLegalClearCell(state, 7, 7)).toBe(true);
  });

  it("rejects out-of-bounds", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells(), "fill");
    expect(isLegalClearCell(state, 9, 0)).toBe(false);
  });

  it("rejects when cell breaks invariants", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[6][6] = { given: 3, notes: new Set([1]) };
    const state = makeState(grid, cells, "fill");
    expect(isLegalClearCell(state, 6, 6)).toBe(false);
  });
});

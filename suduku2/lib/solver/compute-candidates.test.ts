import { describe, expect, it } from "vitest";

import { EMPTY_CELL, isValidPlacement } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import { computeCandidates } from "./candidates";

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

function setDigit(
  grid: Grid9,
  cells: CellState[][],
  r: number,
  c: number,
  n: number,
  role: "given" | "value",
): void {
  grid[r][c] = n;
  cells[r][c] = role === "given" ? { given: n } : { value: n };
}

describe("computeCandidates", () => {
  it("empty board: every empty cell has full 1–9 candidates", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = cand[r][c];
        expect(cell).not.toBeNull();
        if (cell === null) {
          continue;
        }
        expect([...cell].sort((a, b) => a - b)).toEqual(
          [1, 2, 3, 4, 5, 6, 7, 8, 9],
        );
      }
    }
  });

  it("multiple givens: candidates respect all placed digits", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    // Same row as (8,8), same column as (8,8), same 3×3 box as (8,8)
    setDigit(grid, cells, 8, 0, 1, "given");
    setDigit(grid, cells, 0, 8, 2, "given");
    setDigit(grid, cells, 7, 7, 3, "given");
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    expect(cand[8][0]).toBeNull();
    expect(cand[0][8]).toBeNull();
    expect(cand[7][7]).toBeNull();

    const corner = cand[8][8];
    expect(corner).not.toBeNull();
    if (corner === null) {
      return;
    }
    expect(corner.has(1)).toBe(false);
    expect(corner.has(2)).toBe(false);
    expect(corner.has(3)).toBe(false);
    expect(corner.has(4)).toBe(true);
  });

  it("row exclusion: digit in row removes that candidate elsewhere on the row", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 0, 1, 5, "value");
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    const at00 = cand[0][0];
    expect(at00).not.toBeNull();
    if (at00 === null) {
      return;
    }
    expect(at00.has(5)).toBe(false);
    expect(isValidPlacement(state, 0, 0, 5)).toBe(false);
  });

  it("column exclusion: digit in column removes that candidate elsewhere in column", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 3, 2, 7, "given");
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    const at02 = cand[0][2];
    expect(at02).not.toBeNull();
    if (at02 === null) {
      return;
    }
    expect(at02.has(7)).toBe(false);
  });

  it("box exclusion: digit in 3×3 box removes that candidate elsewhere in box", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 0, 0, 9, "given");
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    const at02 = cand[0][2];
    expect(at02).not.toBeNull();
    if (at02 === null) {
      return;
    }
    expect(at02.has(9)).toBe(false);
  });

  it("filled cell: candidates entry is null regardless of stale notes on CellState", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 4, 4, 8, "given");
    cells[4][4] = { given: 8, notes: new Set([1, 2, 3]) };
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);
    expect(cand[4][4]).toBeNull();
  });

  it("empty cell with notes: notes do not shrink computed constraint candidates", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[3][5] = { notes: new Set([1]) };
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    const at35 = cand[3][5];
    expect(at35).not.toBeNull();
    if (at35 === null) {
      return;
    }
    expect([...at35].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { cloneGameState, EMPTY_CELL } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";
import { computeCandidates } from "@/lib/solver";

import { applyFullBoardPencilNotes } from "./fill-all-pencil-notes";

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

function notesEqual(a: Set<number> | undefined, b: Set<number>): boolean {
  if (a === undefined) {
    return b.size === 0;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const x of b) {
    if (!a.has(x)) {
      return false;
    }
  }
  return true;
}

describe("applyFullBoardPencilNotes (task 20)", () => {
  it("does not mutate the input state", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 0, 0, 5, "given");
    cells[1][1] = { notes: new Set([2, 3]) };
    const state = makeState(grid, cells);
    const before = cloneGameState(state);

    applyFullBoardPencilNotes(state);

    expect(state).toEqual(before);
  });

  it("multi-empty cells: each playable empty cell matches computeCandidates", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 8, 0, 1, "given");
    setDigit(grid, cells, 0, 8, 2, "given");
    setDigit(grid, cells, 7, 7, 3, "given");
    setDigit(grid, cells, 1, 1, 6, "value");
    const state = makeState(grid, cells);
    const expected = computeCandidates(state);
    const out = applyFullBoardPencilNotes(state);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const ex = expected[r][c];
        const cell = out.cells[r][c];
        if (ex === null) {
          expect(cell.notes).toBeUndefined();
          continue;
        }
        expect(notesEqual(cell.notes, ex)).toBe(true);
      }
    }
  });

  it("partial notes on empties are replaced by full constraint candidates (not merged)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 0, 1, 5, "value");
    cells[0][0] = { notes: new Set([5, 6, 7]) };
    cells[2][2] = { notes: new Set([1]) };
    const state = makeState(grid, cells);
    const expected = computeCandidates(state);
    const out = applyFullBoardPencilNotes(state);

    const at00 = expected[0][0];
    expect(at00).not.toBeNull();
    if (at00 === null) {
      return;
    }
    expect(at00.has(5)).toBe(false);
    expect(notesEqual(out.cells[0][0].notes, at00)).toBe(true);

    const at22 = expected[2][2];
    expect(at22).not.toBeNull();
    if (at22 === null) {
      return;
    }
    expect([...(out.cells[2][2].notes ?? [])].sort((a, b) => a - b)).toEqual(
      [...at22].sort((a, b) => a - b),
    );
    expect([...at22].sort((a, b) => a - b)).not.toEqual([1]);
  });

  it("given and player-filled cells are not written with pencil notes", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    setDigit(grid, cells, 4, 4, 8, "given");
    cells[4][4] = { given: 8, notes: new Set([1, 2, 3]) };
    setDigit(grid, cells, 2, 3, 4, "value");
    const state = makeState(grid, cells);
    const out = applyFullBoardPencilNotes(state);

    expect(out.cells[4][4].notes).toEqual(new Set([1, 2, 3]));
    expect(out.cells[2][3].notes).toBeUndefined();
  });
});

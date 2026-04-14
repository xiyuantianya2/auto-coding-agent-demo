import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import { cloneGameState } from "./clone";
import type { CellState, GameState, Grid9 } from "./types";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

describe("cloneGameState", () => {
  it("produces independent grid rows and cells; mutating clone does not affect original", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 5;
    cells[0][0] = { value: 5 };
    cells[1][1] = { notes: new Set([1, 2, 3]) };

    const original: GameState = { grid, cells, mode: "fill" };
    const copy = cloneGameState(original);

    expect(copy).not.toBe(original);
    expect(copy.grid).not.toBe(original.grid);
    expect(copy.grid[0]).not.toBe(original.grid[0]);
    expect(copy.cells).not.toBe(original.cells);
    expect(copy.cells[0]).not.toBe(original.cells[0]);
    expect(copy.cells[1][1]).not.toBe(original.cells[1][1]);
    expect(copy.cells[1][1].notes).not.toBe(original.cells[1][1].notes);

    copy.grid[0][0] = 9;
    copy.cells[1][1].notes!.add(9);

    expect(original.grid[0][0]).toBe(5);
    expect(original.cells[1][1].notes!.has(9)).toBe(false);
  });

  it("copies notes to a new Set so clearing clone notes leaves original intact", () => {
    const cells = makeEmptyCells();
    cells[3][4] = { notes: new Set([4, 5]) };
    const original: GameState = {
      grid: makeEmptyGrid(),
      cells,
      mode: "notes",
    };

    const copy = cloneGameState(original);
    copy.cells[3][4].notes!.clear();

    expect(original.cells[3][4].notes!.size).toBe(2);
    expect(copy.cells[3][4].notes!.size).toBe(0);
  });

  it("preserves mode and cell fields (given, value)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[8][8] = { given: 7 };
    cells[0][8] = { value: 2, notes: new Set([1]) };

    const original: GameState = { grid, cells, mode: "notes" };
    const copy = cloneGameState(original);

    expect(copy.mode).toBe("notes");
    expect(copy.cells[8][8].given).toBe(7);
    expect(copy.cells[0][8].value).toBe(2);
    expect([...copy.cells[0][8].notes!]).toEqual([1]);
  });
});

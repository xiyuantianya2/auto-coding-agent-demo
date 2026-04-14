import { describe, expect, it } from "vitest";

import { BOARD_SIZE, boxIndexFromCell, createEmptyGameState } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

import {
  cellsForBox,
  cellsForCol,
  cellsForRow,
  getHighlightCells,
} from "./highlight-filter";

function emptyCandidates(): CandidatesGrid {
  const g: CandidatesGrid = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Set<number>[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(new Set<number>());
    }
    g.push(row);
  }
  return g;
}

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function expectSameCellSet(
  actual: Readonly<{ cells: readonly Readonly<{ r: number; c: number }>[] }>,
  expected: Array<{ r: number; c: number }>,
): void {
  const a = new Set(actual.cells.map((p) => coordKey(p.r, p.c)));
  const e = new Set(expected.map((p) => coordKey(p.r, p.c)));
  expect(a).toEqual(e);
}

describe("getHighlightCells", () => {
  it("row: index 0 covers (0,0)–(0,8)", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    const res = getHighlightCells({ type: "row", index: 0 }, state, candidates);
    expect(res.cells).toHaveLength(9);
    expectSameCellSet(res, Array.from({ length: 9 }, (_, c) => ({ r: 0, c })));
    expect(Object.isFrozen(res)).toBe(true);
    expect(Object.isFrozen(res.cells)).toBe(true);
  });

  it("col: index 2 covers (0,2)–(8,2)", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    const res = getHighlightCells({ type: "col", index: 2 }, state, candidates);
    expectSameCellSet(res, Array.from({ length: 9 }, (_, r) => ({ r, c: 2 })));
  });

  it("box: index 4 is center 3×3, row-major within box (matches boxIndexFromCell)", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    const res = getHighlightCells({ type: "box", index: 4 }, state, candidates);
    const expected: Array<{ r: number; c: number }> = [];
    for (let r = 3; r < 6; r++) {
      for (let c = 3; c < 6; c++) {
        expected.push({ r, c });
      }
    }
    expectSameCellSet(res, expected);
    expect(res.cells.map((p) => `${p.r},${p.c}`).join("|")).toBe(
      "3,3|3,4|3,5|4,3|4,4|4,5|5,3|5,4|5,5",
    );
  });

  it("digit: highlights unsolved cells where digit is in candidates or notes (fixed semantics)", () => {
    const state = createEmptyGameState();
    // (0,0) given-like: mark solved — should not appear for digit 1
    state.cells[0][0] = { given: 1 };

    // (0,1): candidate 1 only
    // (0,2): no candidate, but note 1
    // (0,3): candidate 2 only — not highlighted for digit 1
    const candidates = emptyCandidates();
    candidates[0][1] = new Set([1]);
    candidates[0][3] = new Set([2]);
    state.cells[0][2] = { notes: new Set([1]) };

    const res = getHighlightCells({ type: "digit", index: 0 }, state, candidates);
    expectSameCellSet(res, [
      { r: 0, c: 1 },
      { r: 0, c: 2 },
    ]);
  });

  it("digit: index 8 means digit 9", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    candidates[4][4] = new Set([9]);
    const res = getHighlightCells({ type: "digit", index: 8 }, state, candidates);
    expectSameCellSet(res, [{ r: 4, c: 4 }]);
  });

  it("out-of-range indices yield empty digit / row / col / box lists", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    expect(getHighlightCells({ type: "row", index: 9 }, state, candidates).cells).toEqual([]);
    expect(getHighlightCells({ type: "col", index: -1 }, state, candidates).cells).toEqual([]);
    expect(getHighlightCells({ type: "box", index: 99 }, state, candidates).cells).toEqual([]);
    expect(getHighlightCells({ type: "digit", index: 9 }, state, candidates).cells).toEqual([]);
  });
});

describe("cellsForRow / cellsForCol / cellsForBox", () => {
  it("cellsForRow / cellsForCol match row/col filters", () => {
    const state = createEmptyGameState();
    const candidates = emptyCandidates();
    const rowA = getHighlightCells({ type: "row", index: 0 }, state, candidates).cells;
    expect([...rowA].map((p) => coordKey(p.r, p.c)).sort()).toEqual(
      [...cellsForRow(0)].map((p) => coordKey(p.r, p.c)).sort(),
    );
    const colA = getHighlightCells({ type: "col", index: 5 }, state, candidates).cells;
    expect([...colA].map((p) => coordKey(p.r, p.c)).sort()).toEqual(
      [...cellsForCol(5)].map((p) => coordKey(p.r, p.c)).sort(),
    );
  });

  it("cellsForBox matches boxIndexFromCell for each cell in that box", () => {
    const coords = cellsForBox(7);
    for (const p of coords) {
      expect(boxIndexFromCell(p.r, p.c)).toBe(7);
    }
  });
});

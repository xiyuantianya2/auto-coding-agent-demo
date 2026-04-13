import { describe, expect, it } from "vitest";
import { CellSymbol, EMPTY_CELL, type Board } from "./board-types";
import {
  BASE_SCORE_PER_CELL,
  applyMatchClear,
  findAllMatchPositions,
  hasAnyMatch,
} from "./match-clear";

function boardFromLines(lines: (CellSymbol | typeof EMPTY_CELL)[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

describe("findAllMatchPositions", () => {
  it("collects a horizontal triple and longer runs", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const s = findAllMatchPositions(b);
    expect(s.has("0,0")).toBe(true);
    expect(s.has("0,1")).toBe(true);
    expect(s.has("0,2")).toBe(true);
    expect(s.size).toBe(3);
  });

  it("collects a vertical triple", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Ruby, CellSymbol.Sapphire],
      [CellSymbol.Ruby, CellSymbol.Amber],
    ]);
    const s = findAllMatchPositions(b);
    expect(s.has("0,0")).toBe(true);
    expect(s.has("1,0")).toBe(true);
    expect(s.has("2,0")).toBe(true);
  });

  it("merges overlapping horizontal and vertical matches", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
    ]);
    const s = findAllMatchPositions(b);
    expect(s.size).toBe(5);
  });

  it("ignores empty cells in runs", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, EMPTY_CELL, CellSymbol.Ruby, CellSymbol.Ruby],
    ]);
    expect(hasAnyMatch(b)).toBe(false);
  });
});

describe("applyMatchClear", () => {
  it("returns stable reference and zero score when no matches", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const r = applyMatchClear(b);
    expect(r.board).toBe(b);
    expect(r.clearedCellCount).toBe(0);
    expect(r.score).toBe(0);
  });

  it("clears matched cells and scores per cell", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const r = applyMatchClear(b);
    expect(r.clearedCellCount).toBe(3);
    expect(r.score).toBe(3 * BASE_SCORE_PER_CELL);
    expect(r.board[0]![0]).toBe(EMPTY_CELL);
    expect(r.board[0]![1]).toBe(EMPTY_CELL);
    expect(r.board[0]![2]).toBe(EMPTY_CELL);
    expect(r.board[1]![0]).toBe(CellSymbol.Emerald);
  });
});

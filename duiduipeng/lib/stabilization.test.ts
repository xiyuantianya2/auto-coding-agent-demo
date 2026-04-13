import { describe, expect, it } from "vitest";
import { CellSymbol, DEFAULT_CELL_SYMBOLS, EMPTY_CELL, type Board } from "./board-types";
import { BASE_SCORE_PER_CELL } from "./match-clear";
import { mulberry32 } from "./seeded-random";
import {
  applyGravityAndRefill,
  applyTripleClear,
  boardHasEmpty,
  stabilizeAfterSwap,
} from "./stabilization";

function boardFromLines(lines: (CellSymbol | typeof EMPTY_CELL)[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

describe("applyGravityAndRefill", () => {
  it("packs tiles to the bottom and fills from the top with pool symbols", () => {
    const b = boardFromLines([
      [EMPTY_CELL, CellSymbol.Ruby, EMPTY_CELL],
      [EMPTY_CELL, EMPTY_CELL, CellSymbol.Emerald],
    ]);
    const rnd = mulberry32(42);
    const next = applyGravityAndRefill(b, { random: rnd, symbols: [CellSymbol.Sapphire] });
    expect(boardHasEmpty(next)).toBe(false);
    expect(next[1]![1]).toBe(CellSymbol.Ruby);
    expect(next[1]![2]).toBe(CellSymbol.Emerald);
    expect(next[0]![1]).toBe(CellSymbol.Sapphire);
  });
});

describe("applyTripleClear", () => {
  it("clears triple-line matches only", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Sapphire, CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Amber],
    ]);
    const r = applyTripleClear(b);
    expect(r.tripleClearedCells).toBe(3);
    expect(r.score).toBe(3 * BASE_SCORE_PER_CELL);
    expect(r.board[0]![0]).toBe(EMPTY_CELL);
    expect(r.board[0]![1]).toBe(EMPTY_CELL);
    expect(r.board[0]![2]).toBe(EMPTY_CELL);
    expect(r.board[1]![0]).toBe(CellSymbol.Sapphire);
    expect(r.board[1]![1]).toBe(CellSymbol.Sapphire);
  });
});

describe("stabilizeAfterSwap", () => {
  it("fills the board after clears using a seeded refill", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const a = stabilizeAfterSwap(b, { refillSeed: 7, symbols: DEFAULT_CELL_SYMBOLS });
    const c = stabilizeAfterSwap(b, { refillSeed: 7, symbols: DEFAULT_CELL_SYMBOLS });
    expect(a.board).toEqual(c.board);
    expect(boardHasEmpty(a.board)).toBe(false);
    expect(a.score).toBeGreaterThanOrEqual(3 * BASE_SCORE_PER_CELL);
    expect(a.chainWaves).toBeGreaterThanOrEqual(1);
    expect(typeof a.refillSeedAfter).toBe("number");
  });

  it("does not loop when there are no triples", () => {
    const b = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Ruby, CellSymbol.Emerald],
    ]);
    const r = stabilizeAfterSwap(b, { refillSeed: 1 });
    expect(r.chainWaves).toBe(0);
    expect(r.score).toBe(0);
    expect(r.refillSeedAfter).toBe(1 >>> 0);
  });
});

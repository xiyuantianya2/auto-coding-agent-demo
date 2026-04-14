import { describe, expect, it } from "vitest";

import {
  cloneGameState,
  deserializeGameState,
  serializeGameState,
  type Grid9,
} from "@/lib/core";

import {
  cloneGrid9,
  gameStateFromGivensGrid,
  gameStateFromSolvedGrid,
  generatePuzzle,
  generateRandomCompleteGrid,
  verifyUniqueSolution,
} from "./index";

/** 与 `[0, 1)` 一致的确定性 PRNG（固定 seed 便于断言可复现）。 */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectCompleteValidSudoku(g: Grid9): void {
  expect(g).toHaveLength(9);
  for (let r = 0; r < 9; r++) {
    expect(g[r]).toHaveLength(9);
    const row = new Set<number>();
    for (let c = 0; c < 9; c++) {
      const v = g[r]![c]!;
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
      row.add(v);
    }
    expect(row.size).toBe(9);
  }
  for (let c = 0; c < 9; c++) {
    const col = new Set<number>();
    for (let r = 0; r < 9; r++) {
      col.add(g[r]![c]!);
    }
    expect(col.size).toBe(9);
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = new Set<number>();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          box.add(g[br * 3 + i]![bc * 3 + j]!);
        }
      }
      expect(box.size).toBe(9);
    }
  }
}

describe("puzzle-generator skeleton (task 1)", () => {
  it("generatePuzzle placeholder returns null", () => {
    const rng = () => 0.5;
    expect(generatePuzzle({ tier: "entry", rng })).toBeNull();
  });

  it("verifyUniqueSolution placeholder returns false for an empty grid", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(verifyUniqueSolution(empty)).toBe(false);
  });
});

describe("Grid9 ↔ GameState helpers & random complete solution (task 2)", () => {
  it("generateRandomCompleteGrid (fixed seed) yields 9×9 valid complete sudoku", () => {
    const rng = mulberry32(42_137);
    const grid = generateRandomCompleteGrid(rng);
    expectCompleteValidSudoku(grid);
  });

  it("generateRandomCompleteGrid (random-style rng) yields valid complete sudoku", () => {
    const grid = generateRandomCompleteGrid(mulberry32(Date.now() ^ 0x9e37_79b9));
    expectCompleteValidSudoku(grid);
  });

  it("gameStateFromGivensGrid copies input and does not alias rows with the source", () => {
    const givens: Grid9 = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ((r + c) % 9) + 1),
    );
    const state = gameStateFromGivensGrid(givens);
    givens[0]![0] = 0;
    expect(state.grid[0]![0]).not.toBe(0);
    givens[0] = Array(9).fill(9) as unknown as number[];
    expect(state.grid[0]![1]).not.toBe(9);
  });

  it("gameStateFromSolvedGrid + serialize/deserialize isolates nested data", () => {
    const grid = generateRandomCompleteGrid(mulberry32(7));
    const a = gameStateFromSolvedGrid(grid);
    const json = serializeGameState(a);
    const b = deserializeGameState(json);
    b.grid[0]![0] = 1;
    expect(a.grid[0]![0]).toBe(grid[0]![0]);
  });

  it("cloneGameState does not share grid rows with gameStateFromGivensGrid output", () => {
    const givens: Grid9 = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, (_, c) => (c === 0 ? 5 : 0)),
    );
    const s0 = gameStateFromGivensGrid(givens);
    const s1 = cloneGameState(s0);
    s1.grid[0]![1] = 3;
    s1.cells[0]![1] = { value: 3 };
    expect(s0.grid[0]![1]).toBe(0);
  });

  it("cloneGrid9 returns a deep copy", () => {
    const g = generateRandomCompleteGrid(mulberry32(3));
    const c = cloneGrid9(g);
    c[0]![0] = 99;
    expect(g[0]![0]).not.toBe(99);
  });
});

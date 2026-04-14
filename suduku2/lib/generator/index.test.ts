import { describe, expect, it } from "vitest";

import {
  cloneGameState,
  deserializeGameState,
  serializeGameState,
  type Grid9,
} from "@/lib/core";

import {
  cloneGrid9,
  digHolesFromCompleteSolution,
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

  it("verifyUniqueSolution: empty grid has many solutions → false", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(verifyUniqueSolution(empty)).toBe(false);
  });
});

/** 常见报章谜题（唯一解），与任务 2 随机盘无关。 */
const UNIQUE_FIXTURE: Grid9 = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

describe("verifyUniqueSolution (task 3)", () => {
  it("returns true for a known uniquely-solvable puzzle", () => {
    expect(verifyUniqueSolution(UNIQUE_FIXTURE)).toBe(true);
  });

  it("returns false when givens contradict (duplicate in a row)", () => {
    const bad: Grid9 = UNIQUE_FIXTURE.map((row) => row.slice());
    bad[0]![0] = 6;
    bad[0]![1] = 6;
    expect(verifyUniqueSolution(bad)).toBe(false);
  });

  it("returns false for an unsolvable partial assignment (no duplicate hint)", () => {
    const dead: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    dead[0] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    dead[1] = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(verifyUniqueSolution(dead)).toBe(false);
  });

  it("returns false for empty grid (non-unique)", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(verifyUniqueSolution(empty)).toBe(false);
  });

  it(
    "smoke: heavy-ish search completes with a boolean (no throw)",
    { timeout: 30_000 },
    () => {
      const g = verifyUniqueSolution(UNIQUE_FIXTURE);
      expect(typeof g).toBe("boolean");
    },
  );
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

/**
 * 随机挖洞：用固定 `mulberry32` 种子做确定性断言。
 * 不在此做大规模随机压测（验证器在稀疏盘面下可能较慢，易导致 CI 不稳定）。
 */
describe("dig holes keeping unique solution (task 4)", () => {
  it("fixed rng: dug givens pass verifyUniqueSolution", () => {
    const rng = mulberry32(2026_04_14);
    const solution = generateRandomCompleteGrid(rng);
    const dug = digHolesFromCompleteSolution({
      solution,
      rng: mulberry32(99_001),
      timeoutMs: 8000,
    });
    expect(dug).not.toBeNull();
    expect(verifyUniqueSolution(dug!)).toBe(true);
  });

  it("returns null for non-complete solution grid", () => {
    const bad = generateRandomCompleteGrid(mulberry32(1));
    bad[0]![0] = 0;
    expect(
      digHolesFromCompleteSolution({
        solution: bad,
        rng: mulberry32(2),
        timeoutMs: 1000,
      }),
    ).toBeNull();
  });

  it(
    "smoke: extremely tight timeout still returns a grid and does not throw (may keep many givens)",
    { timeout: 15_000 },
    () => {
      const solution = generateRandomCompleteGrid(mulberry32(500));
      const dug = digHolesFromCompleteSolution({
        solution,
        rng: mulberry32(500),
        timeoutMs: 1,
      });
      expect(dug).not.toBeNull();
      expect(verifyUniqueSolution(dug!)).toBe(true);
    },
  );
});

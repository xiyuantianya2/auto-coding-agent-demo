/**
 * 集成测试：自 `@/lib/core` 的 `GameState` 经克隆/序列化进入 `@/lib/solver` 全流程，
 * 验证与 `module-plan.json` 中 `solver-engine` 契约一致。
 */
import { describe, expect, it } from "vitest";

import {
  EMPTY_CELL,
  cloneGameState,
  deserializeGameState,
  serializeGameState,
} from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import {
  TechniqueIds,
  computeCandidates,
  findApplicableSteps,
  scoreDifficulty,
  type CandidatesGrid,
  type SolveStep,
} from "@/lib/solver";

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

/** 与低阶测试相同终盘；擦去 (0,0) 后出现裸单，便于快速检出步骤。 */
const COMPLETE_SOLUTION: Grid9 = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function buildAlmostSolvedWithOneBlank(): GameState {
  const grid = makeEmptyGrid();
  const cells = makeEmptyCells();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (r === 0 && c === 0) {
        continue;
      }
      grid[r][c] = COMPLETE_SOLUTION[r][c]!;
      cells[r][c] = { given: COMPLETE_SOLUTION[r][c]! };
    }
  }
  return makeState(grid, cells);
}

function assertCandidatesGridShape(cand: CandidatesGrid): void {
  expect(cand.length).toBe(9);
  for (let r = 0; r < 9; r++) {
    expect(cand[r]!.length).toBe(9);
    for (let c = 0; c < 9; c++) {
      const cell = cand[r]![c];
      if (cell === null) {
        expect(
          typeof COMPLETE_SOLUTION[r]![c] === "number" &&
            COMPLETE_SOLUTION[r]![c]! > 0,
        ).toBe(true);
      } else {
        expect(cell.size).toBeGreaterThanOrEqual(1);
        expect(cell.size).toBeLessThanOrEqual(9);
      }
    }
  }
}

function assertSolveStepsShape(steps: SolveStep[]): void {
  expect(Array.isArray(steps)).toBe(true);
  for (const s of steps) {
    expect(typeof s.technique).toBe("string");
    expect(Array.isArray(s.highlights)).toBe(true);
  }
}

function techniqueIdsSignature(steps: SolveStep[]): string {
  return [...steps.map((s) => s.technique)].sort().join(",");
}

describe("solver public API integration (core → candidates → steps → score)", () => {
  it("full path on constructed state, clone, and deserialize round-trip", () => {
    const original = buildAlmostSolvedWithOneBlank();

    const run = (state: GameState) => {
      const cand = computeCandidates(state);
      assertCandidatesGridShape(cand);

      const steps = findApplicableSteps(state);
      assertSolveStepsShape(steps);
      expect(steps.length).toBeGreaterThan(0);
      expect(
        steps.some((s) => s.technique === TechniqueIds.UniqueCandidate),
      ).toBe(true);

      const { score, band } = scoreDifficulty(state, steps);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      if (band !== undefined) {
        expect(Array.isArray(band)).toBe(true);
        expect(band!.length).toBe(2);
        expect(band![0]! <= band![1]!).toBe(true);
      }

      return { sig: techniqueIdsSignature(steps), score };
    };

    const a = run(original);
    const b = run(cloneGameState(original));
    const c = run(deserializeGameState(serializeGameState(original)));

    expect(b.sig).toBe(a.sig);
    expect(c.sig).toBe(a.sig);
    expect(b.score).toBe(a.score);
    expect(c.score).toBe(a.score);
  });
});

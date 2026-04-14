import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import { computeCandidates } from "./candidates";
import {
  findLowTierApplicableSteps,
  type CandidateElimination,
  type CellRef,
} from "./low-tier";
import { TechniqueIds } from "./technique-ids";

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

/** 一组合法终盘；擦去一格后该格应有唯一候选（裸单）。 */
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

describe("findLowTierApplicableSteps", () => {
  it("detects unique-candidate (naked single) when one empty cell has a single candidate", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r === 0 && c === 0) {
          continue;
        }
        setDigit(grid, cells, r, c, COMPLETE_SOLUTION[r][c]!, "given");
      }
    }
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);
    expect(cand[0][0]?.size).toBe(1);

    const steps = findLowTierApplicableSteps(state);
    const naked = steps.filter((s) => s.technique === TechniqueIds.UniqueCandidate);
    expect(naked.length).toBeGreaterThanOrEqual(1);

    const at00 = naked.find((s) => {
      const cell = s.highlights.find((h) => h.kind === "cell")?.ref as CellRef;
      return cell?.r === 0 && cell?.c === 0;
    });
    expect(at00).toBeDefined();
    expect(at00?.eliminations).toBeUndefined();

    const cref = at00?.highlights.find((h) => h.kind === "candidate")
      ?.ref as CellRef & { digit: number };
    expect(cref?.digit).toBe(5);
  });

  it("pointing: eliminations remove digit from peers outside the box along the aligned line", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    /**
     * 宫 0 内第 1–2 行填满；第 0 行前三格为空且与 (0,5) 共构成行上缺失 {3,4,5,6}。
     * 数字 5 在宫 0 内仅出现在第 0 行；第 0 行 (0,5)（在宫外）仍含候选 5 → 指向删候选。
     */
    const givens: Array<[number, number, number]> = [
      [1, 0, 6],
      [1, 1, 7],
      [1, 2, 8],
      [2, 0, 9],
      [2, 1, 1],
      [2, 2, 2],
      [0, 3, 1],
      [0, 4, 2],
      [0, 6, 7],
      [0, 7, 8],
      [0, 8, 9],
    ];
    for (const [r, c, n] of givens) {
      setDigit(grid, cells, r, c, n, "given");
    }
    const state = makeState(grid, cells);
    const cand = computeCandidates(state);

    const inBox0Row0 = [0, 1, 2].some(
      (c) => cand[0][c]?.has(5) === true,
    );
    const outsideBox0Row0 = [3, 4, 5, 6, 7, 8].some(
      (c) => cand[0][c]?.has(5) === true,
    );
    expect(inBox0Row0).toBe(true);
    expect(outsideBox0Row0).toBe(true);

    const steps = findLowTierApplicableSteps(state);
    const pointing = steps.filter((s) => s.technique === TechniqueIds.Pointing);
    expect(pointing.length).toBeGreaterThanOrEqual(1);

    const step = pointing.find((s) =>
      (s.eliminations as CandidateElimination[] | undefined)?.some(
        (e) => e.r === 0 && e.digit === 5,
      ),
    );
    expect(step).toBeDefined();
    const elim = step?.eliminations as CandidateElimination[];
    expect(elim?.length).toBeGreaterThan(0);
    for (const e of elim ?? []) {
      expect(e.digit).toBe(5);
      expect(e.r).toBe(0);
      expect(e.c).toBeGreaterThan(2);
      expect(cand[e.r][e.c]?.has(5)).toBe(true);
    }
  });
});

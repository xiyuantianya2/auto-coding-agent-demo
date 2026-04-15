import { describe, expect, it } from "vitest";

import {
  EMPTY_CELL,
  deserializeGameState,
  serializeGameState,
} from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";
import { findApplicableSteps, TechniqueIds } from "@/lib/solver";
import type { SolveStep } from "@/lib/solver";

import { mapSolveStepToHintResult } from "./map-solve-step-to-hint-result";

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

/** 与 `find-applicable-steps.test` / `low-tier.test` 相同终盘；擦去一格后出现裸单。 */
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

function assertHintShape(h: ReturnType<typeof mapSolveStepToHintResult>): void {
  expect(typeof h.technique).toBe("string");
  expect(Array.isArray(h.cells)).toBe(true);
  for (const p of h.cells) {
    expect(typeof p.r).toBe("number");
    expect(typeof p.c).toBe("number");
  }
  if (h.highlightCandidates !== undefined) {
    expect(Array.isArray(h.highlightCandidates)).toBe(true);
    for (const row of h.highlightCandidates) {
      expect(typeof row.r).toBe("number");
      expect(typeof row.c).toBe("number");
      expect(Array.isArray(row.digits)).toBe(true);
      if (row.eliminate !== undefined) {
        expect(Array.isArray(row.eliminate)).toBe(true);
      }
    }
  }
  if (h.messageKey !== undefined) {
    expect(typeof h.messageKey).toBe("string");
  }
  expect(typeof h.explanation).toBe("string");
  expect(h.explanation.length).toBeGreaterThan(0);
}

describe("mapSolveStepToHintResult", () => {
  it("maps low-tier unique-candidate step from real findApplicableSteps output", () => {
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
    const state = makeState(grid, cells);
    const steps = findApplicableSteps(state);
    const naked = steps.find((s) => s.technique === TechniqueIds.UniqueCandidate);
    expect(naked).toBeDefined();

    const hint = mapSolveStepToHintResult(naked!);
    assertHintShape(hint);
    expect(hint.technique).toBe(TechniqueIds.UniqueCandidate);
    expect(hint.messageKey).toBe(TechniqueIds.UniqueCandidate);
    expect(hint.explanation).toContain("唯一候选");
    expect(hint.cells.some((p) => p.r === 0 && p.c === 0)).toBe(true);
    expect(hint.highlightCandidates?.some((e) => e.r === 0 && e.c === 0 && e.digits.includes(5))).toBe(
      true,
    );

    const rt = deserializeGameState(serializeGameState(state));
    const steps2 = findApplicableSteps(rt);
    const naked2 = steps2.find((s) => s.technique === TechniqueIds.UniqueCandidate);
    expect(naked2).toBeDefined();
    const hint2 = mapSolveStepToHintResult(naked2!);
    expect(hint2.technique).toBe(hint.technique);
    expect(hint2.cells).toEqual(hint.cells);
  });

  it("maps pointing step with eliminations from real solver output", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
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
    const steps = findApplicableSteps(state);
    const pointing = steps.find(
      (s) =>
        s.technique === TechniqueIds.Pointing &&
        Array.isArray(s.eliminations) &&
        s.eliminations.length > 0,
    );
    expect(pointing).toBeDefined();

    const hint = mapSolveStepToHintResult(pointing!);
    assertHintShape(hint);
    expect(hint.technique).toBe(TechniqueIds.Pointing);
    expect(hint.messageKey).toBe(TechniqueIds.Pointing);
    expect(hint.highlightCandidates?.length).toBeGreaterThan(0);
    const hasElim =
      hint.highlightCandidates?.some((e) => e.eliminate !== undefined && e.eliminate!.length > 0) ??
      false;
    expect(hasElim).toBe(true);
    expect(hint.cells.length).toBeGreaterThan(0);
  });

  it("maps hidden-single-shaped step to cells and Chinese explanation", () => {
    const step: SolveStep = {
      technique: TechniqueIds.HiddenSingle,
      highlights: [
        { kind: "unit", ref: { type: "row", index: 2 } },
        { kind: "cell", ref: { r: 2, c: 5 } },
        { kind: "candidate", ref: { r: 2, c: 5, digit: 4 } },
      ],
      explanationKey: TechniqueIds.HiddenSingle,
    };
    const hint = mapSolveStepToHintResult(step);
    assertHintShape(hint);
    expect(hint.explanation).toContain("隐唯一");
    expect(hint.explanation).toContain("第 3 行");
    expect(hint.explanation).toMatch(/4/);
    expect(hint.cells.some((p) => p.r === 2 && p.c === 5)).toBe(true);
  });

  it("passes explanationKey through as messageKey and does not mutate step", () => {
    const step: SolveStep = {
      technique: "custom-tech",
      highlights: [{ kind: "cell", ref: { r: 4, c: 4 } }],
      explanationKey: "explanation.custom",
    };
    const frozen = JSON.stringify(step);
    const hint = mapSolveStepToHintResult(step);
    expect(hint.messageKey).toBe("explanation.custom");
    expect(hint.explanation.length).toBeGreaterThan(0);
    expect(JSON.stringify(step)).toBe(frozen);
  });
});

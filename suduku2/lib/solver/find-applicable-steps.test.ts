import { describe, expect, it } from "vitest";

import {
  EMPTY_CELL,
  deserializeGameState,
  serializeGameState,
} from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import {
  canonicalStepDedupKey,
  findApplicableSteps,
  isRegisteredTechniqueId,
  MAX_FIND_APPLICABLE_MS,
} from "./find-applicable-steps";
import { TechniqueIds } from "./technique-ids";
import type { SolveStep } from "./types";

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

function assertValidSolveSteps(steps: SolveStep[]): void {
  expect(Array.isArray(steps)).toBe(true);
  for (const s of steps) {
    expect(typeof s.technique).toBe("string");
    expect(s.technique.length).toBeGreaterThan(0);
    expect(Array.isArray(s.highlights)).toBe(true);
    for (const h of s.highlights) {
      expect(h.kind === "cell" || h.kind === "unit" || h.kind === "candidate").toBe(
        true,
      );
    }
    if (s.explanationKey !== undefined) {
      expect(typeof s.explanationKey).toBe("string");
    }
  }
}

/** 与 `low-tier.test` 相同终盘；擦去一格后出现裸单。 */
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

describe("findApplicableSteps", () => {
  it("returns well-formed steps with registered technique ids (naked single fixture)", () => {
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
    assertValidSolveSteps(steps);
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(isRegisteredTechniqueId(s.technique)).toBe(true);
    }
    const naked = steps.filter((s) => s.technique === TechniqueIds.UniqueCandidate);
    expect(naked.length).toBeGreaterThanOrEqual(1);
  });

  it("works on deserializeGameState(serializeGameState(state))", () => {
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
    const roundTrip = deserializeGameState(serializeGameState(state));
    const steps = findApplicableSteps(roundTrip);
    assertValidSolveSteps(steps);
    expect(steps.some((s) => s.technique === TechniqueIds.UniqueCandidate)).toBe(
      true,
    );
  });

  it("completes within a loose wall-clock bound on an empty grid (smoke)", () => {
    const state = makeState(makeEmptyGrid(), makeEmptyCells());
    const t0 = Date.now();
    const steps = findApplicableSteps(state);
    const elapsed = Date.now() - t0;
    assertValidSolveSteps(steps);
    expect(elapsed).toBeLessThanOrEqual(MAX_FIND_APPLICABLE_MS + 250);
  });
});

describe("canonicalStepDedupKey", () => {
  it("matches for duplicate elimination sets regardless of elimination order", () => {
    const a: SolveStep = {
      technique: TechniqueIds.Pointing,
      highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }],
      eliminations: [
        { r: 0, c: 3, digit: 5 },
        { r: 0, c: 4, digit: 5 },
      ],
    };
    const b: SolveStep = {
      technique: TechniqueIds.Pointing,
      highlights: [{ kind: "cell", ref: { r: 8, c: 8 } }],
      eliminations: [
        { r: 0, c: 4, digit: 5 },
        { r: 0, c: 3, digit: 5 },
      ],
    };
    expect(canonicalStepDedupKey(a)).toBe(canonicalStepDedupKey(b));
  });
});

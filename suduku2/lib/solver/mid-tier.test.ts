import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import { findLowTierApplicableSteps } from "./low-tier";
import {
  findMidTierApplicableSteps,
  findMidTierStepsFromCandidates,
  type CandidateElimination,
} from "./mid-tier";
import { TechniqueIds } from "./technique-ids";
import type { CandidatesGrid } from "./types";

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

/** 除指定格为候选集合外，其余格视为已填（`null`），仅用于技巧检测单元测试。 */
function syntheticCandidates(
  filled: Array<{ r: number; c: number; digits: number[] }>,
): CandidatesGrid {
  const g: CandidatesGrid = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CandidatesGrid[0][0] => null),
  );
  for (const { r, c, digits } of filled) {
    g[r][c] = new Set(digits);
  }
  return g;
}

describe("findMidTierStepsFromCandidates", () => {
  it("detects naked pair in a row with eliminations", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 0, digits: [1, 2] },
      { r: 0, c: 1, digits: [1, 2] },
      { r: 0, c: 2, digits: [1, 2, 3] },
    ]);
    const steps = findMidTierStepsFromCandidates(cand);
    const np = steps.filter((s) => s.technique === TechniqueIds.NakedPair);
    expect(np.length).toBeGreaterThanOrEqual(1);
    const step = np[0]!;
    const elim = step.eliminations as CandidateElimination[];
    expect(elim.some((e) => e.r === 0 && e.c === 2 && e.digit === 1)).toBe(
      true,
    );
    expect(elim.some((e) => e.r === 0 && e.c === 2 && e.digit === 2)).toBe(
      true,
    );
  });

  it("detects hidden pair: two digits confined to two cells with extra candidates", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 0, digits: [1, 2, 9] },
      { r: 0, c: 1, digits: [1, 2, 8] },
    ]);
    const steps = findMidTierStepsFromCandidates(cand);
    const hp = steps.filter((s) => s.technique === TechniqueIds.HiddenPair);
    expect(hp.length).toBeGreaterThanOrEqual(1);
    const elim = hp[0]!.eliminations as CandidateElimination[];
    expect(elim.some((e) => e.r === 0 && e.c === 0 && e.digit === 9)).toBe(true);
    expect(elim.some((e) => e.r === 0 && e.c === 1 && e.digit === 8)).toBe(true);
  });

  it("detects naked triple and eliminates from peers in the row", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 0, digits: [1, 2] },
      { r: 0, c: 1, digits: [2, 3] },
      { r: 0, c: 2, digits: [1, 3] },
      { r: 0, c: 3, digits: [1, 2, 3, 4] },
    ]);
    const steps = findMidTierStepsFromCandidates(cand);
    const nt = steps.filter((s) => s.technique === TechniqueIds.NakedTriple);
    expect(nt.length).toBeGreaterThanOrEqual(1);
    const elim = nt[0]!.eliminations as CandidateElimination[];
    expect(elim.some((e) => e.r === 0 && e.c === 3 && e.digit === 1)).toBe(true);
    expect(elim.some((e) => e.r === 0 && e.c === 3 && e.digit === 2)).toBe(true);
    expect(elim.some((e) => e.r === 0 && e.c === 3 && e.digit === 3)).toBe(true);
  });

  it("detects hidden triple (three digits confined to three cells)", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 0, digits: [1, 7] },
      { r: 0, c: 1, digits: [2, 8] },
      { r: 0, c: 2, digits: [3, 9] },
    ]);
    const steps = findMidTierStepsFromCandidates(cand);
    const ht = steps.filter((s) => s.technique === TechniqueIds.HiddenTriple);
    expect(ht.length).toBeGreaterThanOrEqual(1);
    const elim = ht[0]!.eliminations as CandidateElimination[];
    expect(elim.length).toBeGreaterThanOrEqual(3);
  });
});

describe("findMidTierApplicableSteps (integration)", () => {
  it("uses distinct TechniqueId from low-tier pointing / box-line", () => {
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
    const low = findLowTierApplicableSteps(state);
    const mid = findMidTierApplicableSteps(state);
    expect(low.some((s) => s.technique === TechniqueIds.Pointing)).toBe(true);
    const midIds = new Set(mid.map((s) => s.technique));
    expect(midIds.has(TechniqueIds.Pointing)).toBe(false);
    expect(midIds.has(TechniqueIds.BoxLineReduction)).toBe(false);
  });
});

describe("performance smoke", () => {
  it(
    "completes on a dense candidate grid without throwing",
    { timeout: 15_000 },
    () => {
      const cand: CandidatesGrid = Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])),
      );
      const t0 = Date.now();
      const steps = findMidTierStepsFromCandidates(cand);
      const elapsed = Date.now() - t0;
      expect(Array.isArray(steps)).toBe(true);
      expect(elapsed).toBeLessThan(12_000);
    },
  );
});

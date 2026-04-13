import { describe, expect, it } from "vitest";
import {
  cloneGameState,
  createGameStateFromGivens,
  gridFromGameState,
  isValidPlacement,
} from "../core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SAMPLE_GIVENS_MINIMAL,
  SOLVED_GRID_SAMPLE,
} from "../core/fixture";
import type { Grid9 } from "../core";
import {
  CandidatesComputationError,
  candidatesGridToSnapshot,
  computeCandidates,
} from "./compute-candidates";

function expectSnapshotMatchesIsValidPlacement(state: ReturnType<typeof createGameStateFromGivens>): void {
  const grid = gridFromGameState(state);
  const cand = computeCandidates(state);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const g = grid[r][c];
      if (g === 0) {
        for (let n = 1; n <= 9; n++) {
          const ok = isValidPlacement(grid, r, c, n);
          expect(cand[r][c].has(n)).toBe(ok);
        }
      } else {
        expect(cand[r][c].size).toBe(0);
      }
    }
  }
}

describe("computeCandidates", () => {
  it("solved board: every cell has empty candidate set", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const cand = computeCandidates(state);
    const snap = candidatesGridToSnapshot(cand);
    expect(snap.flat().every((s) => s === "")).toBe(true);
  });

  it("almost solved: only empty cell (8,8) has single candidate 8", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    const cand = computeCandidates(state);
    expect(cand[8][8]).toEqual(new Set([8]));
    expectSnapshotMatchesIsValidPlacement(state);
  });

  it("sparse givens: matches isValidPlacement for every empty cell", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expectSnapshotMatchesIsValidPlacement(state);
  });

  it("throws on obvious conflict (duplicate in row)", () => {
    const bad: Grid9 = structuredClone(SOLVED_GRID_SAMPLE);
    bad[0][1] = bad[0][0];
    const state = createGameStateFromGivens(bad);
    expect(() => computeCandidates(state)).toThrow(CandidatesComputationError);
    try {
      computeCandidates(state);
    } catch (e) {
      expect(e).toBeInstanceOf(CandidatesComputationError);
      const err = e as CandidatesComputationError;
      expect(err.details.kind).toBe("obvious_conflict");
      if (err.details.kind === "obvious_conflict") {
        expect(err.details.positions.length).toBeGreaterThan(0);
      }
    }
  });

  it("throws empty_cell_candidates when no digit fits an empty cell without obvious duplicate", () => {
    const g: Grid9 = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
    g[0] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    g[1][8] = 9;
    const state = createGameStateFromGivens(g);
    expect(() => computeCandidates(state)).toThrow(CandidatesComputationError);
    try {
      computeCandidates(state);
    } catch (e) {
      expect(e).toBeInstanceOf(CandidatesComputationError);
      const err = e as CandidatesComputationError;
      expect(err.details).toEqual({ kind: "empty_cell_candidates", r: 0, c: 8 });
    }
  });

  it("cloneGameState yields identical candidates", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const a = candidatesGridToSnapshot(computeCandidates(state));
    const b = candidatesGridToSnapshot(computeCandidates(cloneGameState(state)));
    expect(a).toEqual(b);
  });
});

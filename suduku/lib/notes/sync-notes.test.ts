import { describe, expect, it } from "vitest";
import { cloneGameState, createGameStateFromGivens } from "@/lib/core";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SAMPLE_GIVENS_MINIMAL,
  SOLVED_GRID_SAMPLE,
} from "@/lib/core/fixture";
import { computeCandidates } from "@/lib/solver";

import { syncNotesWithCandidates } from "./index";

/** 找一格空格且候选数 < 9，便于构造「多出来的铅笔数」。 */
function findCellWithNonFullCandidates(
  candidates: ReturnType<typeof computeCandidates>,
): { r: number; c: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (candidates[r][c].size > 0 && candidates[r][c].size < 9) {
        return { r, c };
      }
    }
  }
  return null;
}

describe("syncNotesWithCandidates", () => {
  it("does not mutate the input state", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const snapshot = JSON.stringify(state.cells.map((row) => row.map((c) => [...(c.notes ?? [])].sort())));
    const candidates = computeCandidates(state);
    const out = syncNotesWithCandidates(state, candidates);
    expect(out).not.toBe(state);
    expect(JSON.stringify(state.cells.map((row) => row.map((c) => [...(c.notes ?? [])].sort())))).toBe(
      snapshot,
    );
  });

  it("intersects unsolved cell notes with computeCandidates (drops invalid pencil marks)", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const cell = findCellWithNonFullCandidates(candidates);
    expect(cell).not.toBeNull();
    const { r, c } = cell!;
    const allowed = candidates[r][c];
    const wrongDigit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !allowed.has(d));
    expect(wrongDigit).toBeDefined();
    const dirty = cloneGameState(base);
    dirty.cells[r][c].notes = new Set([...allowed, wrongDigit!]);

    const synced = syncNotesWithCandidates(dirty, candidates);
    expect(synced.cells[r][c].notes).toEqual(allowed);
  });

  it("clears notes on given cells (solved by clue)", () => {
    const clean = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(clean);
    const dirty = cloneGameState(clean);
    dirty.cells[0][0].notes = new Set([2, 3, 4]);

    const synced = syncNotesWithCandidates(dirty, candidates);

    expect(synced.cells[0][0].notes?.size).toBe(0);
    expect(dirty.cells[0][0].notes?.size).toBe(3);
  });

  it("clears notes on cells solved by player value", () => {
    const clean = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);
    clean.cells[8][8].value = 8;
    const candidates = computeCandidates(clean);
    const dirty = cloneGameState(clean);
    dirty.cells[8][8].notes = new Set([1, 2]);

    const synced = syncNotesWithCandidates(dirty, candidates);

    expect(synced.cells[8][8].notes?.size).toBe(0);
    expect(synced.cells[8][8].value).toBe(8);
  });

  it("leaves notes unchanged when already a subset of candidates", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(state);
    const r = 1;
    const c = 1;
    const allowed = candidates[r][c];
    const subset = new Set([...allowed].slice(0, Math.min(2, allowed.size)));
    state.cells[r][c].notes = subset;

    const synced = syncNotesWithCandidates(state, candidates);
    expect(synced.cells[r][c].notes).toEqual(subset);
  });

  it("clone independence: mutating synced result does not affect a second sync from original", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const dirty = cloneGameState(base);
    dirty.cells[2][2].notes = new Set([1, 2, 3, 9]);
    const a = syncNotesWithCandidates(dirty, candidates);
    a.cells[2][2].notes!.add(9);
    const b = syncNotesWithCandidates(dirty, candidates);
    expect(b.cells[2][2].notes?.has(9)).toBe(candidates[2][2].has(9));
  });
});

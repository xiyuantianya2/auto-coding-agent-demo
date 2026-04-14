import { test, expect } from "@playwright/test";
import { cloneGameState, createEmptyGameState, createGameStateFromGivens } from "@/lib/core";
import { SAMPLE_GIVENS_MINIMAL, SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import { computeCandidates } from "@/lib/solver";
import {
  applyNotesCommand,
  createUndoStack,
  getHighlightCells,
  syncNotesWithCandidates,
} from "@/lib/notes";

test.describe("Suduku notes logic (contract smoke)", () => {
  test("applyNotesCommand stub clones; syncNotesWithCandidates tightens notes vs candidates", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(state);

    const toggled = applyNotesCommand(state, { type: "toggle", payload: { r: 0, c: 0, digit: 1 } }, candidates);
    expect(toggled).not.toBe(state);
    expect(toggled).toEqual(state);

    const synced = syncNotesWithCandidates(state, candidates);
    expect(synced).not.toBe(state);
    expect(synced).toEqual(state);

    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candSparse = computeCandidates(base);
    let picked: { r: number; c: number; wrong: number } | null = null;
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const allowed = candSparse[r][c];
        if (allowed.size === 0) continue;
        const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !allowed.has(d));
        if (wrong !== undefined) {
          picked = { r, c, wrong };
          break outer;
        }
      }
    }
    expect(picked).not.toBeNull();
    const { r, c, wrong } = picked!;
    const allowed = candSparse[r][c];
    const dirty = cloneGameState(base);
    dirty.cells[r][c].notes = new Set([...allowed, wrong]);
    const syncedSparse = syncNotesWithCandidates(dirty, candSparse);
    expect(syncedSparse.cells[r][c].notes).toEqual(allowed);
  });

  test("createUndoStack stub: undo returns null until implemented", () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    stack.push(state);
    expect(stack.undo()).toBeNull();
  });

  test("getHighlightCells row/box/digit matches lib contract (smoke)", () => {
    const state = createEmptyGameState();
    const candidates = computeCandidates(state);
    const row0 = getHighlightCells({ type: "row", index: 0 }, state, candidates);
    expect(row0.cells).toHaveLength(9);
    const box4 = getHighlightCells({ type: "box", index: 4 }, state, candidates);
    expect(box4.cells).toHaveLength(9);
    const digit = getHighlightCells({ type: "digit", index: 0 }, state, candidates);
    expect(digit.cells.length).toBeGreaterThan(0);
  });

  test("clone isolation after stub apply still holds for callers", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(state);
    const next = applyNotesCommand(state, { type: "clearCell", payload: { r: 0, c: 0 } }, candidates);
    next.cells[0][0].notes = new Set([1, 2]);
    expect(state.cells[0][0].notes?.size ?? 0).toBe(0);

    const copy = cloneGameState(state);
    expect(applyNotesCommand(state, { type: "setMode", payload: { mode: "notes" } }, candidates)).toEqual(
      copy,
    );
  });
});

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
  test("applyNotesCommand toggles notes vs candidates; syncNotesWithCandidates tightens notes vs candidates", () => {
    const sparse = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const sparseCand = computeCandidates(sparse);
    const tr = 4;
    const tc = 4;
    const tdigit = [...sparseCand[tr][tc]][0];
    const toggled = applyNotesCommand(
      sparse,
      { type: "toggle", payload: { r: tr, c: tc, digit: tdigit } },
      sparseCand,
    );
    expect(toggled).not.toBe(sparse);
    expect(toggled.cells[tr][tc].notes?.has(tdigit)).toBe(true);

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(state);
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

  test("createUndoStack: push clones snapshot, undo pops LIFO", () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    stack.push(state);
    const restored = stack.undo();
    expect(restored).not.toBeNull();
    expect(restored).toEqual(state);
    expect(restored).not.toBe(state);
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

  test("clone isolation after applyNotesCommand still holds for callers", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const tr = 4;
    const tc = 4;
    const tdigit = [...candidates[tr][tc]][0];
    const withNote = applyNotesCommand(
      base,
      { type: "toggle", payload: { r: tr, c: tc, digit: tdigit } },
      candidates,
    );
    const next = applyNotesCommand(withNote, { type: "clearCell", payload: { r: tr, c: tc } }, candidates);
    next.cells[tr][tc].notes = new Set([1, 2]);
    expect(withNote.cells[tr][tc].notes?.has(tdigit)).toBe(true);

    const mode = applyNotesCommand(base, { type: "setMode", payload: { mode: "notes" } }, candidates);
    expect(mode.inputMode).toBe("notes");
    expect(mode.cells[tr][tc].notes?.size ?? 0).toBe(0);
  });

  test("applyNotesCommand batchClear clears notes on listed cells", () => {
    const base = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const candidates = computeCandidates(base);
    const tr = 3;
    const tc = 3;
    const tdigit = [...candidates[tr][tc]][0];
    const withNote = applyNotesCommand(
      base,
      { type: "toggle", payload: { r: tr, c: tc, digit: tdigit } },
      candidates,
    );
    const cleared = applyNotesCommand(
      withNote,
      { type: "batchClear", payload: { cells: [{ r: tr, c: tc }, { r: 0, c: 0 }] } },
      candidates,
    );
    expect(cleared.cells[tr][tc].notes?.size ?? 0).toBe(0);
    expect(cleared.cells[0][0].given).toBe(base.cells[0][0].given);
  });
});

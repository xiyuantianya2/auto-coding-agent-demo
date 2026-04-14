import { test, expect } from "@playwright/test";
import { cloneGameState, createGameStateFromGivens } from "@/lib/core";
import { SOLVED_GRID_SAMPLE } from "@/lib/core/fixture";
import { computeCandidates } from "@/lib/solver";
import {
  applyNotesCommand,
  createUndoStack,
  syncNotesWithCandidates,
} from "@/lib/notes";

test.describe("Suduku notes logic (contract smoke)", () => {
  test("applyNotesCommand / syncNotesWithCandidates stubs clone GameState", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    const candidates = computeCandidates(state);

    const toggled = applyNotesCommand(state, { type: "toggle", payload: { r: 0, c: 0, digit: 1 } }, candidates);
    expect(toggled).not.toBe(state);
    expect(toggled).toEqual(state);

    const synced = syncNotesWithCandidates(state, candidates);
    expect(synced).not.toBe(state);
    expect(synced).toEqual(state);
  });

  test("createUndoStack stub: undo returns null until implemented", () => {
    const stack = createUndoStack();
    expect(stack.undo()).toBeNull();

    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    stack.push(state);
    expect(stack.undo()).toBeNull();
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

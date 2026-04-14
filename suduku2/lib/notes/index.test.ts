import { describe, expect, it } from "vitest";

import {
  cloneGameState,
  EMPTY_CELL,
  serializeGameState,
  type CellState,
  type GameState,
  type Grid9,
} from "@/lib/core";
import { computeCandidates } from "@/lib/solver";

import {
  applyCommand,
  createUndoRedo,
  syncNotesAfterValue,
} from "@/lib/notes";

function makeMinimalState(): GameState {
  const grid: Grid9 = Array.from({ length: 9 }, () =>
    Array<number>(9).fill(EMPTY_CELL),
  );
  const cells: CellState[][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
  return { grid, cells, mode: "fill" };
}

describe("@/lib/notes skeleton (task 1)", () => {
  it("createUndoRedo starts with no undo/redo until history exists", () => {
    const api = createUndoRedo();
    expect(api.canUndo()).toBe(false);
    expect(api.canRedo()).toBe(false);
    expect(api.undo()).toBeNull();
    expect(api.redo()).toBeNull();
    expect(() => api.push(makeMinimalState())).not.toThrow();
  });

  it("applyCommand throws until implemented", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    expect(() =>
      applyCommand(state, { type: "setMode", payload: { mode: "notes" } }, candidates),
    ).toThrow("not implemented");
  });
});

describe("createUndoRedo", () => {
  it("supports consecutive push and canUndo after the first checkpoint", () => {
    const api = createUndoRedo();
    const a = makeMinimalState();
    const b = cloneGameState(a);
    b.grid[0][0] = 3;
    b.cells[0][0] = { value: 3 };

    api.push(a);
    expect(api.canUndo()).toBe(false);
    expect(api.canRedo()).toBe(false);

    api.push(b);
    expect(api.canUndo()).toBe(true);
    expect(api.canRedo()).toBe(false);
  });

  it("undo/redo round-trip restores snapshots", () => {
    const api = createUndoRedo();
    const first = makeMinimalState();
    const second = cloneGameState(first);
    second.mode = "notes";

    api.push(first);
    api.push(second);

    const u = api.undo();
    expect(u).not.toBeNull();
    expect(u!.mode).toBe("fill");

    const r = api.redo();
    expect(r).not.toBeNull();
    expect(r!.mode).toBe("notes");
  });

  it("push after undo clears the redo branch (canRedo becomes false)", () => {
    const api = createUndoRedo();
    const s0 = makeMinimalState();
    const s1 = cloneGameState(s0);
    s1.mode = "notes";

    api.push(s0);
    api.push(s1);
    expect(api.undo()!.mode).toBe("fill");
    expect(api.canRedo()).toBe(true);

    api.push(cloneGameState(s0));
    expect(api.canRedo()).toBe(false);
    expect(api.redo()).toBeNull();
  });

  it("does not let mutations to saved or returned states corrupt the stack (reference isolation)", () => {
    const api = createUndoRedo();
    const older = makeMinimalState();
    older.cells[4][4] = { notes: new Set([1, 2]) };
    const newer = cloneGameState(older);
    newer.cells[4][4] = { notes: new Set([7, 8]) };

    api.push(older);
    api.push(newer);

    older.cells[4][4] = { notes: new Set([99]) };

    const undone = api.undo()!;
    expect([...(undone.cells[4][4].notes ?? [])].sort((a, b) => a - b)).toEqual([1, 2]);

    undone.cells[4][4] = { notes: new Set([5, 6]) };

    const redone = api.redo()!;
    expect([...(redone.cells[4][4].notes ?? [])].sort((a, b) => a - b)).toEqual([7, 8]);
  });
});

describe("syncNotesAfterValue", () => {
  it("clears notes on filled cells", () => {
    const state = makeMinimalState();
    state.grid[0][0] = 5;
    state.cells[0][0] = {
      value: 5,
      notes: new Set([1, 2, 3]),
    };

    const candidates = computeCandidates(state);
    const out = syncNotesAfterValue(state, candidates);

    expect(out.cells[0][0].notes).toBeUndefined();
    expect(state.cells[0][0].notes).toEqual(new Set([1, 2, 3]));
  });

  it("removes the filled digit from notes in same row, column, and box peers", () => {
    const state = makeMinimalState();
    state.grid[0][0] = 5;
    state.cells[0][0] = { value: 5 };

    state.cells[0][1] = { notes: new Set([5, 6]) };
    state.cells[1][0] = { notes: new Set([4, 5]) };
    state.cells[1][1] = { notes: new Set([5]) };

    const candidates = computeCandidates(state);
    const out = syncNotesAfterValue(state, candidates);

    expect(out.cells[0][1].notes).toEqual(new Set([6]));
    expect(out.cells[1][0].notes).toEqual(new Set([4]));
    expect(out.cells[1][1].notes).toBeUndefined();
  });

  it("trims notes to intersection with candidates for empty cells (optional pruning)", () => {
    const state = makeMinimalState();
    state.cells[2][2] = { notes: new Set([1, 2, 3, 4, 5]) };

    const candidates = computeCandidates(state);
    candidates[2][2] = new Set([1, 2]);

    const out = syncNotesAfterValue(state, candidates);

    expect([...(out.cells[2][2].notes ?? [])].sort((a, b) => a - b)).toEqual([1, 2]);
    expect([...(state.cells[2][2].notes ?? [])].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("does not mutate the input GameState (snapshot semantics)", () => {
    const state = makeMinimalState();
    state.grid[0][0] = 7;
    state.cells[0][0] = { value: 7 };
    state.cells[0][1] = { notes: new Set([7, 8]) };

    const before = serializeGameState(state);
    const candidates = computeCandidates(state);
    syncNotesAfterValue(state, candidates);
    const after = serializeGameState(state);

    expect(after).toBe(before);
  });
});

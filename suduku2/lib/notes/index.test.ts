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

  it("applyCommand setMode is implemented (fill → notes)", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    const out = applyCommand(state, { type: "setMode", payload: { mode: "notes" } }, candidates);
    expect(out.mode).toBe("notes");
    expect(state.mode).toBe("fill");
  });
});

describe("applyCommand (setMode / toggle / clearCell)", () => {
  it("setMode: invalid payload returns a fresh clone equal to input", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    const out = applyCommand(state, { type: "setMode", payload: { mode: "invalid" } }, candidates);
    expect(serializeGameState(out)).toBe(serializeGameState(state));
    expect(out).not.toBe(state);
  });

  it("toggle: adds and removes a note in notes mode; does not mutate input", () => {
    const state = makeMinimalState();
    state.mode = "notes";
    const candidates = computeCandidates(state);

    const a = applyCommand(state, { type: "toggle", payload: { r: 2, c: 3, digit: 4 } }, candidates);
    expect([...(a.cells[2][3].notes ?? [])].sort((x, y) => x - y)).toEqual([4]);
    expect(a.grid[2][3]).toBe(EMPTY_CELL);

    const b = applyCommand(a, { type: "toggle", payload: { r: 2, c: 3, digit: 4 } }, candidates);
    expect(b.cells[2][3].notes).toBeUndefined();
    expect(b.grid[2][3]).toBe(EMPTY_CELL);

    expect(state.cells[2][3].notes).toBeUndefined();
  });

  it("toggle: rejects fill mode, given cells, and filled cells (returns clone of prior state)", () => {
    const base = makeMinimalState();
    const candidates = computeCandidates(base);

    const inFill = applyCommand(
      base,
      { type: "toggle", payload: { r: 1, c: 1, digit: 5 } },
      candidates,
    );
    expect(serializeGameState(inFill)).toBe(serializeGameState(base));

    const withGiven = cloneGameState(base);
    withGiven.grid[0][0] = 9;
    withGiven.cells[0][0] = { given: 9 };
    withGiven.mode = "notes";
    const cg = computeCandidates(withGiven);
    const g = applyCommand(withGiven, { type: "toggle", payload: { r: 0, c: 0, digit: 1 } }, cg);
    expect(serializeGameState(g)).toBe(serializeGameState(withGiven));

    const withValue = cloneGameState(base);
    withValue.mode = "notes";
    withValue.grid[4][4] = 8;
    withValue.cells[4][4] = { value: 8 };
    const cv = computeCandidates(withValue);
    const v = applyCommand(withValue, { type: "toggle", payload: { r: 4, c: 4, digit: 1 } }, cv);
    expect(serializeGameState(v)).toBe(serializeGameState(withValue));
  });

  it("clearCell: removes player value and syncs grid (value-only cell)", () => {
    const state = makeMinimalState();
    state.grid[3][5] = 7;
    state.cells[3][5] = { value: 7 };
    const candidates = computeCandidates(state);

    const out = applyCommand(state, { type: "clearCell", payload: { r: 3, c: 5 } }, candidates);

    expect(out.cells[3][5].value).toBeUndefined();
    expect(out.cells[3][5].notes).toBeUndefined();
    expect(out.grid[3][5]).toBe(EMPTY_CELL);
    expect(state.cells[3][5].value).toBe(7);
  });

  it("clearCell: idempotent on empty cell with notes (notes unchanged)", () => {
    const state = makeMinimalState();
    state.mode = "notes";
    state.cells[2][2] = { notes: new Set([3, 4]) };
    const candidates = computeCandidates(state);

    const out = applyCommand(state, { type: "clearCell", payload: { r: 2, c: 2 } }, candidates);

    expect([...(out.cells[2][2].notes ?? [])].sort((a, b) => a - b)).toEqual([3, 4]);
    expect(out.grid[2][2]).toBe(EMPTY_CELL);
  });

  it("clearCell: rejects given cells and leaves state unchanged", () => {
    const state = makeMinimalState();
    state.grid[0][0] = 5;
    state.cells[0][0] = { given: 5 };
    const candidates = computeCandidates(state);

    const out = applyCommand(state, { type: "clearCell", payload: { r: 0, c: 0 } }, candidates);
    expect(serializeGameState(out)).toBe(serializeGameState(state));
  });

  it("undo / redo branches are still not implemented", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    expect(() => applyCommand(state, { type: "undo", payload: {} }, candidates)).toThrow(
      "not implemented",
    );
    expect(() => applyCommand(state, { type: "redo", payload: {} }, candidates)).toThrow(
      "not implemented",
    );
  });
});

describe("applyCommand (fill) + syncNotesAfterValue", () => {
  it("legal fill updates grid/cells and syncs notes like syncNotesAfterValue alone", () => {
    const base = makeMinimalState();
    base.cells[0][1] = { notes: new Set([5, 6]) };
    base.cells[1][0] = { notes: new Set([4, 5]) };
    base.cells[1][1] = { notes: new Set([5]) };

    const state = cloneGameState(base);
    state.grid[0][0] = 5;
    state.cells[0][0] = { value: 5 };

    const candidatesAfter = computeCandidates(state);
    const expected = syncNotesAfterValue(state, candidatesAfter);

    const beforeFill = computeCandidates(base);
    const out = applyCommand(
      base,
      { type: "fill", payload: { r: 0, c: 0, digit: 5 } },
      beforeFill,
    );

    expect(serializeGameState(out)).toBe(serializeGameState(expected));
    expect(base.grid[0][0]).toBe(EMPTY_CELL);
  });

  it("legal fill matches manual fill then syncNotesAfterValue (solver candidates)", () => {
    const base = makeMinimalState();
    const candidates = computeCandidates(base);

    const manual = cloneGameState(base);
    manual.grid[0][0] = 1;
    manual.cells[0][0] = { value: 1 };
    const afterSync = syncNotesAfterValue(manual, candidates);

    const viaCmd = applyCommand(base, { type: "fill", payload: { r: 0, c: 0, digit: 1 } }, candidates);
    expect(serializeGameState(viaCmd)).toBe(serializeGameState(afterSync));
  });

  it("illegal fill leaves state unchanged (clone of prior)", () => {
    const state = makeMinimalState();
    state.mode = "notes";
    const candidates = computeCandidates(state);
    const out = applyCommand(state, { type: "fill", payload: { r: 0, c: 0, digit: 1 } }, candidates);
    expect(serializeGameState(out)).toBe(serializeGameState(state));
    expect(out).not.toBe(state);
  });

  it("illegal fill: conflicting digit returns unchanged logical state", () => {
    const state = makeMinimalState();
    state.grid[0][1] = 1;
    state.cells[0][1] = { value: 1 };
    const candidates = computeCandidates(state);

    const out = applyCommand(state, { type: "fill", payload: { r: 0, c: 0, digit: 1 } }, candidates);
    expect(serializeGameState(out)).toBe(serializeGameState(state));
  });

  it("illegal fill: bad payload returns unchanged logical state", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    const out = applyCommand(state, { type: "fill", payload: { r: "x", c: 0, digit: 1 } }, candidates);
    expect(serializeGameState(out)).toBe(serializeGameState(state));
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

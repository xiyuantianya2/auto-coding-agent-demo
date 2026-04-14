import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";
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
  it("createUndoRedo returns a consistent empty-stack placeholder", () => {
    const api = createUndoRedo();
    expect(api.canUndo()).toBe(false);
    expect(api.canRedo()).toBe(false);
    expect(api.undo()).toBeNull();
    expect(api.redo()).toBeNull();
    expect(() => api.push(makeMinimalState())).not.toThrow();
  });

  it("applyCommand and syncNotesAfterValue throw until implemented", () => {
    const state = makeMinimalState();
    const candidates = computeCandidates(state);
    expect(() =>
      applyCommand(state, { type: "setMode", payload: { mode: "notes" } }, candidates),
    ).toThrow("not implemented");
    expect(() => syncNotesAfterValue(state, candidates)).toThrow("not implemented");
  });
});

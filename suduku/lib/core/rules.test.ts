import { describe, expect, it } from "vitest";
import { createEmptyGameState, createGameStateFromGivens } from "./factory";
import { SAMPLE_GIVENS_MINIMAL, SOLVED_GRID_SAMPLE } from "./fixture";
import { isValidPlacement } from "./placement";
import {
  canModifyCell,
  cellStateMeetsModelInvariants,
  effectiveDigit,
  findObviousConflictPositions,
  gameStateMeetsModelInvariants,
  gridFromGameState,
  hasObviousConflict,
  isBoardComplete,
  isGivenCell,
  isLegalClearValue,
  isLegalSetValue,
  isLegalToggleNote,
  isWinningState,
} from "./rules";
import type { CellState } from "./types";

describe("gridFromGameState / effectiveDigit", () => {
  it("uses given over value for display digit", () => {
    const state = createEmptyGameState();
    state.cells[0][0] = { given: 5, value: 3, notes: new Set() };
    expect(effectiveDigit(state.cells[0][0])).toBe(5);
    expect(gridFromGameState(state)[0][0]).toBe(5);
  });

  it("uses player value when no given", () => {
    const state = createEmptyGameState();
    state.cells[1][1] = { value: 4, notes: new Set() };
    expect(gridFromGameState(state)[1][1]).toBe(4);
  });
});

describe("cellStateMeetsModelInvariants", () => {
  it("rejects given and value together", () => {
    const bad: CellState = { given: 1, value: 2, notes: new Set() };
    expect(cellStateMeetsModelInvariants(bad)).toBe(false);
  });

  it("rejects notes when value is set", () => {
    const bad: CellState = { value: 3, notes: new Set([1, 2]) };
    expect(cellStateMeetsModelInvariants(bad)).toBe(false);
  });

  it("allows empty notes on empty cell", () => {
    expect(cellStateMeetsModelInvariants({ notes: new Set() })).toBe(true);
  });

  it("allows value with empty notes", () => {
    expect(cellStateMeetsModelInvariants({ value: 7, notes: new Set() })).toBe(true);
  });
});

describe("canModifyCell / given rules", () => {
  const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);

  it("marks givens as not modifiable", () => {
    expect(isGivenCell(state.cells[0][0])).toBe(true);
    expect(canModifyCell(state, 0, 0)).toBe(false);
  });

  it("allows empty playable cells", () => {
    expect(canModifyCell(state, 0, 1)).toBe(true);
    expect(canModifyCell(state, 8, 8)).toBe(true);
  });

  it("returns false out of bounds", () => {
    expect(canModifyCell(state, -1, 0)).toBe(false);
    expect(canModifyCell(state, 0, 9)).toBe(false);
  });
});

describe("isLegalSetValue / isLegalClearValue / isLegalToggleNote", () => {
  it("forbids writing on givens", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalSetValue(state, 0, 0, 5)).toBe(false);
    expect(isLegalClearValue(state, 0, 0)).toBe(false);
    expect(isLegalToggleNote(state, 0, 0, 1)).toBe(false);
  });

  it("allows a valid placement on an empty cell", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalSetValue(state, 3, 3, 4)).toBe(true);
  });

  it("rejects placement that breaks row rule", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalSetValue(state, 0, 1, 5)).toBe(false);
  });

  it("allows clearing a player value", () => {
    const state = createEmptyGameState();
    state.cells[2][2] = { value: 8, notes: new Set() };
    expect(isLegalClearValue(state, 2, 2)).toBe(true);
  });

  it("disallows clear when no value", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalClearValue(state, 0, 1)).toBe(false);
  });

  it("disallows notes when a value is present", () => {
    const state = createEmptyGameState();
    state.cells[4][4] = { value: 2, notes: new Set() };
    expect(isLegalToggleNote(state, 4, 4, 3)).toBe(false);
  });

  it("allows note toggle on empty editable cell", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalToggleNote(state, 4, 4, 9)).toBe(true);
  });

  it("rejects setValue when state invariants are broken", () => {
    const state = createEmptyGameState();
    state.cells[0][0] = { value: 1, notes: new Set([2]) };
    expect(gameStateMeetsModelInvariants(state)).toBe(false);
    expect(isLegalSetValue(state, 1, 1, 5)).toBe(false);
  });
});

describe("isBoardComplete / isWinningState", () => {
  it("SOLVED_GRID_SAMPLE is internally consistent under isValidPlacement", () => {
    const g = SOLVED_GRID_SAMPLE;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const n = g[r][c];
        expect(isValidPlacement(g, r, c, n), `cell ${r},${c} digit ${n}`).toBe(true);
      }
    }
  });

  it("wins on a full valid grid from givens-only state", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(isBoardComplete(state)).toBe(true);
    expect(isWinningState(state)).toBe(true);
  });

  it("is not complete with empty cells", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isBoardComplete(state)).toBe(false);
    expect(isWinningState(state)).toBe(false);
  });

  it("is complete but not winning when obvious duplicates exist", () => {
    const grid = SOLVED_GRID_SAMPLE.map((row) => [...row]);
    grid[0][8] = 3;
    const state = createGameStateFromGivens(grid as typeof SOLVED_GRID_SAMPLE);
    expect(isBoardComplete(state)).toBe(true);
    expect(isWinningState(state)).toBe(false);
    expect(hasObviousConflict(state)).toBe(true);
  });

  it("full grid that breaks classic rules fails isWinningState", () => {
    const grid = SOLVED_GRID_SAMPLE.map((row) => [...row]);
    grid[0][0] = 2;
    grid[0][1] = 1;
    const state = createGameStateFromGivens(grid as typeof SOLVED_GRID_SAMPLE);
    expect(isBoardComplete(state)).toBe(true);
    expect(isWinningState(state)).toBe(false);
  });
});

describe("hasObviousConflict / findObviousConflictPositions", () => {
  it("detects duplicate in row", () => {
    const grid = SAMPLE_GIVENS_MINIMAL.map((row) => [...row]);
    grid[3][0] = 4;
    grid[3][1] = 4;
    const state = createGameStateFromGivens(grid as typeof SAMPLE_GIVENS_MINIMAL);
    expect(hasObviousConflict(state)).toBe(true);
    const pos = findObviousConflictPositions(state);
    expect(pos.some((p) => p.r === 3 && p.c === 0)).toBe(true);
    expect(pos.some((p) => p.r === 3 && p.c === 1)).toBe(true);
  });

  it("no conflict on minimal valid sample", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(hasObviousConflict(state)).toBe(false);
    expect(findObviousConflictPositions(state)).toHaveLength(0);
  });

  it("no conflict on solved sample", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(hasObviousConflict(state)).toBe(false);
  });
});

describe("gameStateMeetsModelInvariants (whole board)", () => {
  it("factory givens state passes", () => {
    expect(gameStateMeetsModelInvariants(createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL))).toBe(
      true,
    );
  });
});

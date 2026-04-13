import { describe, expect, it } from "vitest";
import { cloneGameState } from "./clone";
import { createGameStateFromGivens } from "./factory";
import {
  ALMOST_SOLVED_ONE_EMPTY,
  SAMPLE_GIVENS_MINIMAL,
  SOLVED_GRID_SAMPLE,
} from "./fixture";
import { deserializeGameState, serializeGameState } from "./serialize";
import {
  gridFromGameState,
  isBoardComplete,
  isLegalClearValue,
  isLegalSetValue,
  isLegalToggleNote,
  isWinningState,
} from "./rules";

/**
 * Integration-style flows combining factories, rule checks, win detection,
 * serialization, and cloning — stable contract for downstream modules (e.g. solver-engine).
 */

function assertRoundTripEqualsClone(state: ReturnType<typeof createGameStateFromGivens>) {
  const json = serializeGameState(state);
  const back = deserializeGameState(json);
  expect(back).toEqual(cloneGameState(state));
}

describe("core-model integration: minimal givens → moves → not won → round-trip → clone isolation", () => {
  it("runs notes, placement, rejects illegal win, survives serialize + clone", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL, {
      puzzleSeed: "integration-minimal",
    });

    expect(isWinningState(state)).toBe(false);
    expect(isBoardComplete(state)).toBe(false);

    expect(isLegalToggleNote(state, 4, 4, 2)).toBe(true);
    state.cells[4][4].notes?.add(2);
    expect(isLegalToggleNote(state, 4, 4, 9)).toBe(true);
    state.cells[4][4].notes?.add(9);

    expect(isLegalSetValue(state, 3, 3, 4)).toBe(true);
    state.cells[3][3].value = 4;
    state.cells[3][3].notes = new Set<number>();

    expect(isLegalSetValue(state, 0, 1, 5)).toBe(false);
    expect(isWinningState(state)).toBe(false);

    assertRoundTripEqualsClone(state);

    const snapshot = cloneGameState(state);
    const fork = cloneGameState(state);
    fork.cells[0][1].value = 1;
    fork.cells[0][1].notes = new Set<number>();
    expect(isWinningState(fork)).toBe(false);

    expect(state.cells[0][1].value).toBeUndefined();
    expect(snapshot.cells[0][1].value).toBeUndefined();
  });
});

describe("core-model integration: one move from solved → win → serialize → deserialize", () => {
  it("completes the last cell and matches clone after JSON round-trip", () => {
    const state = createGameStateFromGivens(ALMOST_SOLVED_ONE_EMPTY);

    expect(isBoardComplete(state)).toBe(false);
    expect(isWinningState(state)).toBe(false);
    expect(isLegalSetValue(state, 8, 8, 8)).toBe(true);

    const working = cloneGameState(state);
    working.cells[8][8].value = 8;
    working.cells[8][8].notes = new Set<number>();

    expect(isBoardComplete(working)).toBe(true);
    expect(isWinningState(working)).toBe(true);

    assertRoundTripEqualsClone(working);

    const fromJson = deserializeGameState(serializeGameState(working));
    expect(isWinningState(fromJson)).toBe(true);
    expect(gridFromGameState(fromJson)).toEqual(SOLVED_GRID_SAMPLE);
  });
});

describe("core-model integration: full solved givens → lossy edit → no win", () => {
  it("clone then break a row; original solved grid stays winning in its clone copy", () => {
    const solved = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(isWinningState(solved)).toBe(true);

    const broken = cloneGameState(solved);
    broken.cells[0][8].given = 3;
    broken.cells[0][8].value = undefined;
    broken.cells[0][8].notes = new Set<number>();

    expect(isWinningState(broken)).toBe(false);

    const stillGood = cloneGameState(solved);
    expect(isWinningState(stillGood)).toBe(true);
  });
});

describe("core-model integration: clearValue legality after placing a temp value", () => {
  it("allows clear on a playable cell after a legal set", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    expect(isLegalSetValue(state, 5, 5, 1)).toBe(true);
    state.cells[5][5].value = 1;
    state.cells[5][5].notes = new Set<number>();

    expect(isLegalClearValue(state, 5, 5)).toBe(true);
    delete state.cells[5][5].value;
    state.cells[5][5].notes = new Set<number>();

    expect(state.cells[5][5].value).toBeUndefined();
    assertRoundTripEqualsClone(state);
  });
});

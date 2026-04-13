import { describe, expect, it } from "vitest";
import { cloneGameState } from "./clone";
import { createEmptyGameState, createGameStateFromGivens } from "./factory";
import { SAMPLE_GIVENS_MINIMAL, SOLVED_GRID_SAMPLE } from "./fixture";
import {
  deserializeGameState,
  GameStateSerializationError,
  serializeGameState,
} from "./serialize";

describe("serializeGameState / deserializeGameState", () => {
  it("round-trip matches cloneGameState (structure, digits, Sets, mode, archive)", () => {
    const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL, {
      mode: { kind: "endless", tier: "normal", levelIndex: 2 },
      puzzleSeed: "seed-1",
      archive: {
        endlessProgress: {
          normal: { currentLevel: 4, bestTimesMs: { 1: 10_000, 2: 20_500 } },
        },
        practiceProgress: {
          x: { unlocked: true, streak: 1, bestTimeMs: 3000 },
        },
        tutorialProgress: { ch1: true },
      },
    });
    state.startedAtMs = 1_700_000_000_000;
    state.elapsedMs = 42_000;
    state.cells[4][4].notes = new Set([9, 2, 5]);
    state.cells[0][1].value = 3;

    const json = serializeGameState(state);
    const back = deserializeGameState(json);

    expect(back).toEqual(cloneGameState(state));
  });

  it("round-trip preserves empty notes and givens-only grids", () => {
    const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);
    expect(deserializeGameState(serializeGameState(state))).toEqual(cloneGameState(state));
  });

  it("round-trip on empty classic game", () => {
    const state = createEmptyGameState();
    expect(deserializeGameState(serializeGameState(state))).toEqual(cloneGameState(state));
  });

  it("rejects non-JSON input with GameStateSerializationError", () => {
    expect(() => deserializeGameState("not json {{{")).toThrow(GameStateSerializationError);
  });

  it("rejects JSON root that is not an object", () => {
    expect(() => deserializeGameState("42")).toThrow(GameStateSerializationError);
  });

  it("rejects structurally invalid payload (missing cells)", () => {
    expect(() => deserializeGameState('{"formatVersion":1,"mode":{"kind":"classic"},"archive":{"endlessProgress":{},"practiceProgress":{},"tutorialProgress":{}}}')).toThrow(
      GameStateSerializationError,
    );
  });

  it("rejects unsupported formatVersion", () => {
    const bad = JSON.stringify({
      formatVersion: 999,
      cells: [],
      mode: { kind: "classic" },
      archive: { endlessProgress: {}, practiceProgress: {}, tutorialProgress: {} },
    });
    expect(() => deserializeGameState(bad)).toThrow(GameStateSerializationError);
  });

  it("rejects out-of-range digit in a cell", () => {
    const g = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const payload = JSON.parse(serializeGameState(g)) as Record<string, unknown>;
    const cells = payload.cells as { given?: number }[][];
    cells[0][0].given = 99;
    expect(() => deserializeGameState(JSON.stringify(payload))).toThrow(GameStateSerializationError);
  });
});

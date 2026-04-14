import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "./constants";
import { cloneGameState } from "./clone";
import {
  DeserializeGameStateError,
  deserializeGameState,
  SERIALIZATION_SCHEMA_VERSION,
  serializeGameState,
} from "./serialize";
import type { CellState, GameState, Grid9 } from "./types";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function expectStatesEqual(a: GameState, b: GameState): void {
  expect(a.mode).toBe(b.mode);
  expect(a.grid).toEqual(b.grid);
  expect(a.cells.length).toBe(9);
  expect(b.cells.length).toBe(9);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const ca = a.cells[r][c];
      const cb = b.cells[r][c];
      expect(ca.given).toBe(cb.given);
      expect(ca.value).toBe(cb.value);
      const na = ca.notes ? [...ca.notes].sort((x, y) => x - y) : undefined;
      const nb = cb.notes ? [...cb.notes].sort((x, y) => x - y) : undefined;
      expect(na).toEqual(nb);
    }
  }
}

describe("serializeGameState / deserializeGameState", () => {
  it("round-trips a typical state (given, value, notes, both modes)", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 5;
    cells[0][0] = { given: 5 };
    grid[2][3] = 7;
    cells[2][3] = { value: 7 };
    cells[4][4] = { notes: new Set([9, 3, 3, 1]) };
    grid[8][8] = 2;
    cells[8][8] = { value: 2 };

    const original: GameState = { grid, cells, mode: "notes" };
    const json = serializeGameState(original);
    const parsed = deserializeGameState(json);
    expectStatesEqual(parsed, original);

    const notesMode = cloneGameState(parsed);
    notesMode.mode = "fill";
    const json2 = serializeGameState(notesMode);
    const parsed2 = deserializeGameState(json2);
    expectStatesEqual(parsed2, notesMode);
  });

  it("serializes notes as sorted arrays in JSON", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    cells[1][2] = { notes: new Set([9, 1, 5]) };
    const state: GameState = { grid, cells, mode: "fill" };
    const json = serializeGameState(state);
    expect(json).toContain('"notes":[1,5,9]');
    const obj = JSON.parse(json) as { schemaVersion: number };
    expect(obj.schemaVersion).toBe(SERIALIZATION_SCHEMA_VERSION);
  });

  it("throws DeserializeGameStateError on invalid JSON", () => {
    expect(() => deserializeGameState("{")).toThrow(DeserializeGameStateError);
  });

  it("throws on missing or wrong schemaVersion", () => {
    expect(() => deserializeGameState("{}")).toThrow(DeserializeGameStateError);
    expect(() =>
      deserializeGameState(
        JSON.stringify({
          schemaVersion: 2,
          mode: "fill",
          grid: makeEmptyGrid(),
          cells: makeEmptyCells(),
        }),
      ),
    ).toThrow(DeserializeGameStateError);
    expect(() =>
      deserializeGameState(
        JSON.stringify({
          schemaVersion: "1",
          mode: "fill",
          grid: makeEmptyGrid(),
          cells: makeEmptyCells(),
        }),
      ),
    ).toThrow(DeserializeGameStateError);
  });

  it("throws on wrong mode type or value", () => {
    const base = {
      schemaVersion: SERIALIZATION_SCHEMA_VERSION,
      grid: makeEmptyGrid(),
      cells: makeEmptyCells(),
    };
    expect(() =>
      deserializeGameState(JSON.stringify({ ...base, mode: 1 })),
    ).toThrow(DeserializeGameStateError);
    expect(() =>
      deserializeGameState(JSON.stringify({ ...base, mode: "play" })),
    ).toThrow(DeserializeGameStateError);
  });

  it("throws on grid shape or out-of-range digits", () => {
    const base = {
      schemaVersion: SERIALIZATION_SCHEMA_VERSION,
      mode: "fill" as const,
      cells: makeEmptyCells(),
    };
    expect(() =>
      deserializeGameState(
        JSON.stringify({
          ...base,
          grid: makeEmptyGrid().slice(0, 8),
        }),
      ),
    ).toThrow(DeserializeGameStateError);
    const badDigit = makeEmptyGrid();
    badDigit[0][0] = 10;
    expect(() =>
      deserializeGameState(
        JSON.stringify({
          ...base,
          grid: badDigit,
        }),
      ),
    ).toThrow(DeserializeGameStateError);
  });

  it("throws on cell field type errors or unknown keys", () => {
    const base = {
      schemaVersion: SERIALIZATION_SCHEMA_VERSION,
      mode: "fill" as const,
      grid: makeEmptyGrid(),
    };
    const cells = makeEmptyCells();
    (cells[0][0] as unknown as { notes: string }).notes = "1,2";
    expect(() =>
      deserializeGameState(JSON.stringify({ ...base, cells })),
    ).toThrow(DeserializeGameStateError);

    const cells2 = makeEmptyCells();
    (cells2[0][0] as unknown as { extra: number }).extra = 1;
    expect(() =>
      deserializeGameState(JSON.stringify({ ...base, cells: cells2 })),
    ).toThrow(DeserializeGameStateError);
  });

  it("throws when grid and cells effective digit disagree", () => {
    const grid = makeEmptyGrid();
    const cells = makeEmptyCells();
    grid[0][0] = 3;
    cells[0][0] = { value: 4 };
    expect(() =>
      deserializeGameState(
        JSON.stringify({
          schemaVersion: SERIALIZATION_SCHEMA_VERSION,
          mode: "fill",
          grid,
          cells,
        }),
      ),
    ).toThrow(DeserializeGameStateError);
  });

  it("rejects oversized JSON strings", () => {
    const huge = " ".repeat(512 * 1024 + 1);
    expect(() => deserializeGameState(huge)).toThrow(DeserializeGameStateError);
  });
});

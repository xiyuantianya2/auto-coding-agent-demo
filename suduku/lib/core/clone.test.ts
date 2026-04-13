import { describe, expect, it } from "vitest";
import { cloneGameState } from "./clone";
import { createEmptyGameState, createGameStateFromGivens } from "./factory";
import { SAMPLE_GIVENS_MINIMAL } from "./fixture";

describe("cloneGameState", () => {
  it("mutating clone cell notes does not change the original state", () => {
    const original = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);
    const before = original.cells[4][4].notes ? new Set(original.cells[4][4].notes) : undefined;

    const copy = cloneGameState(original);
    copy.cells[4][4].notes?.add(1);
    copy.cells[4][4].notes?.add(2);

    expect(original.cells[4][4].notes?.has(1)).toBe(false);
    expect(original.cells[4][4].notes?.has(2)).toBe(false);
    expect(before?.size).toBe(original.cells[4][4].notes?.size);
  });

  it("mutating clone cell value does not change the original state", () => {
    const original = createEmptyGameState();
    original.cells[3][3] = { value: 5, notes: new Set() };

    const copy = cloneGameState(original);
    copy.cells[3][3].value = 9;

    expect(original.cells[3][3].value).toBe(5);
    expect(copy.cells[3][3].value).toBe(9);
  });

  it("does not share the cells matrix or row arrays with the original", () => {
    const original = createEmptyGameState();
    const copy = cloneGameState(original);
    expect(original.cells).not.toBe(copy.cells);
    expect(original.cells[0]).not.toBe(copy.cells[0]);
  });
});

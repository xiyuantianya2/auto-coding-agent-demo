import { describe, expect, it } from "vitest";

import { cloneGameState } from "@/lib/core";

import {
  gameStateFromGivensGrid,
  gameStateMatchesGivensGrid,
} from "./grid-game-state";

describe("gameStateMatchesGivensGrid", () => {
  it("is true for a state built from the same givens grid", () => {
    const givens = gameStateFromGivensGrid([
      [5, 0, 0, 0, 0, 0, 0, 0, 0],
      ...Array.from({ length: 8 }, () => Array<number>(9).fill(0)),
    ] as number[][]);
    const g = givens.grid.map((row) => [...row]);
    expect(gameStateMatchesGivensGrid(g, givens)).toBe(true);
  });

  it("is false when givens disagree", () => {
    const givensGrid = [
      [5, 0, 0, 0, 0, 0, 0, 0, 0],
      ...Array.from({ length: 8 }, () => Array<number>(9).fill(0)),
    ] as number[][];
    const base = gameStateFromGivensGrid(givensGrid);
    const wrong = cloneGameState(base);
    wrong.cells[0][0] = { given: 3 };
    expect(gameStateMatchesGivensGrid(givensGrid, wrong)).toBe(false);
  });
});

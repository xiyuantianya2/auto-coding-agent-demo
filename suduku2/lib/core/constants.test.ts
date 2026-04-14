import { describe, expect, it } from "vitest";

import {
  BOX_HEIGHT,
  BOX_WIDTH,
  CELL_COUNT,
  EMPTY_CELL,
  GRID_SIZE,
  isFilledDigit,
  isGridDigit,
  isValidCellCoord,
  isValidColIndex,
  isValidRowIndex,
  MAX_DIGIT,
  MIN_DIGIT,
} from "./constants";

describe("lib/core constants", () => {
  it("exposes 9×9 geometry", () => {
    expect(GRID_SIZE).toBe(9);
    expect(BOX_HEIGHT).toBe(3);
    expect(BOX_WIDTH).toBe(3);
    expect(CELL_COUNT).toBe(81);
  });

  it("defines digit and empty sentinel", () => {
    expect(MIN_DIGIT).toBe(1);
    expect(MAX_DIGIT).toBe(9);
    expect(EMPTY_CELL).toBe(0);
  });

  it("validates coordinates in O(1)", () => {
    expect(isValidRowIndex(0)).toBe(true);
    expect(isValidRowIndex(8)).toBe(true);
    expect(isValidRowIndex(-1)).toBe(false);
    expect(isValidRowIndex(9)).toBe(false);
    expect(isValidRowIndex(1.5)).toBe(false);

    expect(isValidColIndex(0)).toBe(true);
    expect(isValidColIndex(8)).toBe(true);
    expect(isValidColIndex(9)).toBe(false);

    expect(isValidCellCoord(0, 0)).toBe(true);
    expect(isValidCellCoord(8, 8)).toBe(true);
    expect(isValidCellCoord(8, 9)).toBe(false);
  });

  it("validates grid digits", () => {
    expect(isFilledDigit(1)).toBe(true);
    expect(isFilledDigit(9)).toBe(true);
    expect(isFilledDigit(0)).toBe(false);
    expect(isFilledDigit(10)).toBe(false);

    expect(isGridDigit(0)).toBe(true);
    expect(isGridDigit(5)).toBe(true);
    expect(isGridDigit(10)).toBe(false);
  });
});

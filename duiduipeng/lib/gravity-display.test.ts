import { describe, expect, it } from "vitest";
import { CellSymbol, EMPTY_CELL } from "./board-types";
import { computeGravityRefillOffsets } from "./gravity-display";

describe("computeGravityRefillOffsets", () => {
  it("pairs column fall sources bottom-first and spawns from above", () => {
    const rows = 4;
    const boardAfterClear = [
      [CellSymbol.Ruby],
      [EMPTY_CELL],
      [CellSymbol.Emerald],
      [EMPTY_CELL],
    ];
    const finalBoard = [
      [CellSymbol.Sapphire],
      [CellSymbol.Amber],
      [CellSymbol.Ruby],
      [CellSymbol.Emerald],
    ];
    const o = computeGravityRefillOffsets(boardAfterClear, finalBoard);
    expect(o.length).toBe(rows);
    expect(o[0]![0]!.translateYRowUnits).toBe(-(rows + 2));
    expect(o[1]![0]!.translateYRowUnits).toBe(-(rows + 2));
    expect(o[2]![0]!.translateYRowUnits).toBe(-2);
    expect(o[3]![0]!.translateYRowUnits).toBe(-1);
  });
});

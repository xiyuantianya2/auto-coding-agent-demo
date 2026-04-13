import { describe, expect, it } from "vitest";
import { enumerateConnectablePairs, hasAtLeastOneConnectablePair } from "./connectivity";
import { isBoardFullySolvable } from "./full-solvability";
import type { Board, PatternId } from "./types";

function boardFromFlat(
  rows: number,
  cols: number,
  flat: PatternId[],
): Board {
  if (flat.length !== rows * cols) {
    throw new Error("flat length mismatch");
  }
  const cells: (PatternId | null)[][] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const row: (PatternId | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(flat[k++]!);
    }
    cells.push(row);
  }
  return { rows, cols, cells };
}

describe("isBoardFullySolvable", () => {
  it("treats an empty board as solvable", () => {
    const board: Board = {
      rows: 2,
      cols: 2,
      cells: [
        [null, null],
        [null, null],
      ],
    };
    expect(isBoardFullySolvable(board)).toBe(true);
  });

  it("returns true for a trivial 1×2 pair (obviously clearable)", () => {
    const board = boardFromFlat(1, 2, [1, 1]);
    expect(isBoardFullySolvable(board)).toBe(true);
  });

  it("returns true for a small 2×2 with two adjacent pairs", () => {
    const board = boardFromFlat(2, 2, [1, 1, 2, 2]);
    expect(isBoardFullySolvable(board)).toBe(true);
  });

  /**
   * Hand-crafted 2×3 layout (search over multiset permutations found this case):
   *   1 2 3
   *   1 3 2
   * At least one connectable pair exists, but no elimination sequence clears the board.
   */
  it("returns false when a connectable pair exists but the board is a global dead end", () => {
    const board = boardFromFlat(2, 3, [1, 2, 3, 1, 3, 2]);
    expect(hasAtLeastOneConnectablePair(board)).toBe(true);
    expect(enumerateConnectablePairs(board).length).toBeGreaterThan(0);
    expect(isBoardFullySolvable(board)).toBe(false);
  });
});

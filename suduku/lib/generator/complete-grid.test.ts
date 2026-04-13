import { describe, expect, it } from "vitest";

import type { Grid9 } from "../core";
import { isValidPlacement } from "../core";
import { createRngFromSeed } from "./rng";
import { generateCompleteGrid } from "./complete-grid";

function assertFilledValidSudoku(grid: Grid9): void {
  expect(grid).toHaveLength(9);
  for (let r = 0; r < 9; r++) {
    expect(grid[r]).toHaveLength(9);
    for (let c = 0; c < 9; c++) {
      const v = grid[r]![c]!;
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
      expect(isValidPlacement(grid, r, c, v)).toBe(true);
    }
  }
}

describe("generateCompleteGrid", () => {
  it("produces a valid full grid for a fixed seed (repeatable)", () => {
    const rng = createRngFromSeed("0123456789abcdef0123456789abcdef");
    const a = generateCompleteGrid(rng);
    const rng2 = createRngFromSeed("0123456789abcdef0123456789abcdef");
    const b = generateCompleteGrid(rng2);
    assertFilledValidSudoku(a);
    assertFilledValidSudoku(b);
    expect(a).toEqual(b);
  });

  it("does not always yield the same board when the rng stream differs", () => {
    const g1 = generateCompleteGrid(createRngFromSeed("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    const g2 = generateCompleteGrid(createRngFromSeed("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    expect(g1).not.toEqual(g2);
  });
});

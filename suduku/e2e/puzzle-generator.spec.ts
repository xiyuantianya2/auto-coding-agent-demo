import { test, expect } from "@playwright/test";
import type { Grid9 } from "@/lib/core";
import { generatePuzzle, verifyUniqueSolution } from "@/lib/generator";

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

test.describe("Suduku puzzle generator (contract smoke)", () => {
  test("generatePuzzle and verifyUniqueSolution are exported stubs", () => {
    expect(() =>
      generatePuzzle({
        tier: "easy",
        rng: () => 0.5,
      }),
    ).toThrow(/not implemented yet/);

    expect(() => verifyUniqueSolution(EMPTY_GRID)).toThrow(/not implemented yet/);
  });
});

import { describe, expect, it } from "vitest";

import type { Grid9 } from "@/lib/core";

import { generatePuzzle, verifyUniqueSolution } from "./index";

describe("puzzle-generator skeleton (task 1)", () => {
  it("generatePuzzle placeholder returns null", () => {
    const rng = () => 0.5;
    expect(generatePuzzle({ tier: "entry", rng })).toBeNull();
  });

  it("verifyUniqueSolution placeholder returns false for an empty grid", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(verifyUniqueSolution(empty)).toBe(false);
  });
});

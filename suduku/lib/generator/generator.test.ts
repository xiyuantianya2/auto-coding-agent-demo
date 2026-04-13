import { describe, expect, it } from "vitest";

import { generatePuzzle, isValidPuzzleSeedString } from "./index";

describe("generatePuzzle (stub pipeline + seed)", () => {
  it("fills a canonical seed and empty givens on success path", () => {
    let i = 0;
    const draws = [0.1, 0.2, 0.3, 0.4];
    const spec = generatePuzzle({
      tier: "easy",
      rng: () => draws[i++],
    });
    expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
    expect(spec.seed).toBe("19999999333333334ccccccc66666666");
    expect(spec.difficultyScore).toBe(0);
    expect(spec.requiredTechniques).toEqual([]);
    expect(spec.givens.every((row) => row.every((c) => c === 0))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import type { Grid9 } from "../core";
import { SOLVED_GRID_SAMPLE } from "../core/fixture";
import { createRngFromSeed } from "./rng";

import { DIFFICULTY_TIER_CONFIG } from "./difficulty-tier-config";
import { digPuzzleFromSolution } from "./dig-puzzle";
import { verifyUniqueSolution } from "./verify-unique-solution";

function countFilledDigits(grid: Grid9): number {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c]! !== 0) n++;
    }
  }
  return n;
}

describe("digPuzzleFromSolution", () => {
  it("does not mutate the source completed grid", () => {
    const before = SOLVED_GRID_SAMPLE.map((row) => [...row]) as Grid9;
    digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier: "easy",
      rng: createRngFromSeed("0123456789abcdef0123456789abcdef"),
    });
    expect(SOLVED_GRID_SAMPLE).toEqual(before);
  });

  it("fixed终盘 + 固定 rng：结果唯一解且给定数不少于档位下界", () => {
    const rng = createRngFromSeed("0123456789abcdef0123456789abcdef");
    const tier = "normal" as const;
    const minGivens = DIFFICULTY_TIER_CONFIG[tier].givensCount.min;

    const givens = digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier,
      rng,
    });

    expect(verifyUniqueSolution(givens)).toBe(true);
    expect(countFilledDigits(givens)).toBeGreaterThanOrEqual(minGivens);
  });

  it("fixed终盘与 rng 序列可复现同一挖空结果", () => {
    const seed = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const a = digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier: "hard",
      rng: createRngFromSeed(seed),
    });
    const b = digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier: "hard",
      rng: createRngFromSeed(seed),
    });
    expect(a).toEqual(b);
    expect(verifyUniqueSolution(a)).toBe(true);
    expect(countFilledDigits(a)).toBeGreaterThanOrEqual(
      DIFFICULTY_TIER_CONFIG.hard.givensCount.min,
    );
  });

  it("maxUniqueChecks=0 时不调用唯一性校验路径上的删格，保持终盘不变", () => {
    const givens = digPuzzleFromSolution({
      completedGrid: SOLVED_GRID_SAMPLE,
      tier: "hell",
      rng: () => 0,
      maxUniqueChecks: 0,
    });
    expect(givens).toEqual(SOLVED_GRID_SAMPLE);
    expect(verifyUniqueSolution(givens)).toBe(true);
  });
});

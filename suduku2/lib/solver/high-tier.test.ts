import { describe, expect, it } from "vitest";

import type { CandidatesGrid } from "./types";

import {
  findHighTierStepsFromCandidates,
  MAX_HI_PATTERN_PROBES,
} from "./high-tier";
import type { CandidateElimination } from "./mid-tier";
import { TechniqueIds } from "./technique-ids";

/** 除指定格为候选集合外，其余格视为已填（`null`），仅用于技巧检测单元测试。 */
function syntheticCandidates(
  filled: Array<{ r: number; c: number; digits: number[] }>,
): CandidatesGrid {
  const g: CandidatesGrid = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CandidatesGrid[0][0] => null),
  );
  for (const { r, c, digits } of filled) {
    g[r][c] = new Set(digits);
  }
  return g;
}

describe("findHighTierStepsFromCandidates (X-Wing)", () => {
  it("detects row-based X-Wing on digit 5 and lists eliminations", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 2, digits: [5] },
      { r: 0, c: 7, digits: [5] },
      { r: 1, c: 2, digits: [5] },
      { r: 1, c: 7, digits: [5] },
      { r: 2, c: 2, digits: [1, 5] },
    ]);
    const steps = findHighTierStepsFromCandidates(cand);
    const xw = steps.filter((s) => s.technique === TechniqueIds.XWing);
    expect(xw.length).toBeGreaterThanOrEqual(1);
    const elim = xw[0]!.eliminations as CandidateElimination[];
    expect(elim.some((e) => e.r === 2 && e.c === 2 && e.digit === 5)).toBe(
      true,
    );
  });

  it("exits safely when wall-clock budget is already exhausted", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 2, digits: [5] },
      { r: 0, c: 7, digits: [5] },
      { r: 1, c: 2, digits: [5] },
      { r: 1, c: 7, digits: [5] },
      { r: 2, c: 2, digits: [1, 5] },
    ]);
    const steps = findHighTierStepsFromCandidates(cand, {
      deadlineMs: Date.now() - 1,
    });
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBe(0);
  });

  it("exits safely when pattern-probe budget is zero (no probes allowed)", () => {
    const cand = syntheticCandidates([
      { r: 0, c: 2, digits: [5] },
      { r: 0, c: 7, digits: [5] },
      { r: 1, c: 2, digits: [5] },
      { r: 1, c: 7, digits: [5] },
      { r: 2, c: 2, digits: [1, 5] },
    ]);
    const steps = findHighTierStepsFromCandidates(cand, {
      maxPatternProbes: 0,
    });
    expect(steps.length).toBe(0);
  });
});

describe("high-tier performance smoke", () => {
  it(
    "full candidate grid completes without throwing (bounded probes)",
    { timeout: 15_000 },
    () => {
      const cand: CandidatesGrid = Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])),
      );
      const t0 = Date.now();
      const steps = findHighTierStepsFromCandidates(cand, {
        maxPatternProbes: MAX_HI_PATTERN_PROBES,
      });
      const elapsed = Date.now() - t0;
      expect(Array.isArray(steps)).toBe(true);
      expect(elapsed).toBeLessThan(12_000);
    },
  );
});

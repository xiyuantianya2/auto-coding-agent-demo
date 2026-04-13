import { describe, expect, it } from "vitest";

import { TECHNIQUE_IDS } from "../solver";

import {
  DIFFICULTY_TIER_CONFIG,
  DIFFICULTY_TIER_ORDER,
  DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY,
  allowedTechniquesForTier,
} from "./difficulty-tier-config";

const KNOWN_TECHNIQUE_ID_SET = new Set<string>(
  Object.values(TECHNIQUE_IDS) as string[],
);

describe("DIFFICULTY_TIER_CONFIG", () => {
  it("documents score-range overlap policy and uses non-overlapping adjacent ranges when policy is none", () => {
    expect(DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY).toBe("none");

    for (let i = 0; i < DIFFICULTY_TIER_ORDER.length - 1; i++) {
      const a = DIFFICULTY_TIER_CONFIG[DIFFICULTY_TIER_ORDER[i]!]!
        .difficultyScoreRange;
      const b = DIFFICULTY_TIER_CONFIG[DIFFICULTY_TIER_ORDER[i + 1]!]!
        .difficultyScoreRange;
      expect(a.max).toBeLessThan(b.min);
    }
  });

  it("raises technique ceiling monotonically from easy to hell", () => {
    for (let i = 0; i < DIFFICULTY_TIER_ORDER.length - 1; i++) {
      const lo =
        DIFFICULTY_TIER_CONFIG[DIFFICULTY_TIER_ORDER[i]!]!
          .maxTechniqueResolutionOrderIndex;
      const hi =
        DIFFICULTY_TIER_CONFIG[DIFFICULTY_TIER_ORDER[i + 1]!]!
          .maxTechniqueResolutionOrderIndex;
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });

  it("keeps givens min/max sane and min <= max per tier", () => {
    for (const tier of DIFFICULTY_TIER_ORDER) {
      const { min, max } = DIFFICULTY_TIER_CONFIG[tier].givensCount;
      expect(min).toBeGreaterThanOrEqual(17);
      expect(max).toBeLessThanOrEqual(81);
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it("lists only TechniqueIds that exist in TECHNIQUE_IDS", () => {
    for (const tier of DIFFICULTY_TIER_ORDER) {
      for (const id of allowedTechniquesForTier(tier)) {
        expect(KNOWN_TECHNIQUE_ID_SET.has(id)).toBe(true);
      }
    }
  });
});

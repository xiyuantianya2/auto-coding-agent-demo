import { describe, expect, it } from "vitest";

import { TECHNIQUE_IDS } from "@/lib/solver";

import { getCurriculumTree } from "./curriculum";
import {
  PRACTICE_MODE_ID_PREFIX,
  UnknownTechniqueIdError,
  getPracticeModeForTechnique,
  isValidPracticeModeId,
  listPracticeModesByTier,
  listPracticeModesForChapter,
} from "./practice-mode";

describe("getPracticeModeForTechnique (task 5)", () => {
  it("for every TECHNIQUE_IDS entry: endless true and modeId matches documented prefix", () => {
    const modeIds = new Set<string>();
    for (const techniqueId of Object.values(TECHNIQUE_IDS)) {
      const pm = getPracticeModeForTechnique(techniqueId);
      expect(pm.endless).toBe(true);
      expect(pm.modeId).toBe(`${PRACTICE_MODE_ID_PREFIX}${techniqueId}`);
      expect(isValidPracticeModeId(pm.modeId)).toBe(true);
      expect(modeIds.has(pm.modeId)).toBe(false);
      modeIds.add(pm.modeId);
    }
    expect(modeIds.size).toBe(Object.keys(TECHNIQUE_IDS).length);
  });

  it("throws UnknownTechniqueIdError for unknown ids (fixed failure path)", () => {
    expect(() => getPracticeModeForTechnique("__not_registered__")).toThrow(
      UnknownTechniqueIdError,
    );
    try {
      getPracticeModeForTechnique("__not_registered__");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTechniqueIdError);
      expect((e as UnknownTechniqueIdError).techniqueId).toBe("__not_registered__");
    }
  });

  it("listPracticeModesForChapter returns modes for a real chapter id", () => {
    const tree = getCurriculumTree();
    const first = tree[0]!;
    const list = listPracticeModesForChapter(first.id);
    expect(list.length).toBe(first.techniqueIds.length);
    for (let i = 0; i < list.length; i++) {
      const tid = first.techniqueIds[i]!;
      expect(list[i]).toEqual({
        techniqueId: tid,
        ...getPracticeModeForTechnique(tid),
      });
    }
  });

  it("listPracticeModesByTier aggregates by tier", () => {
    const low = listPracticeModesByTier("low");
    const lowIds = new Set(getCurriculumTree().filter((n) => n.tier === "low").map((n) => n.id));
    for (const row of low) {
      expect(lowIds.has(row.chapterId)).toBe(true);
      expect({ modeId: row.modeId, endless: row.endless }).toEqual(
        getPracticeModeForTechnique(row.techniqueId),
      );
    }
  });
});

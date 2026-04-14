/**
 * 集成：整棵树 + 技巧校验 → 解锁图 → 解锁判定 → 专项 modeId；
 * 与 {@link TECHNIQUE_IDS} 对齐，防止与 solver 技巧表脱节。
 */

import { describe, expect, it } from "vitest";

import { isValidPlacement, type Grid9 } from "@/lib/core";
import { TECHNIQUE_IDS } from "@/lib/solver";

import { getCurriculumTree } from "./curriculum";
import {
  getChapterById,
  getChaptersByTier,
  getChaptersForTechnique,
  getPracticeModeForTechnique,
  isChapterUnlocked,
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
  validateUnlockGraph,
} from "./index";

describe("curriculum integration (task 6)", () => {
  it("chains: technique validation → unlock graph → sample unlock → practice modeId", () => {
    const tree = getCurriculumTree();

    expect(validateCurriculumTechniqueIds(tree)).toEqual({ ok: true });
    expect(validateUnlockGraph(tree)).toEqual({ ok: true });

    const root = tree.find((n) => n.unlockAfter === undefined);
    expect(root).toBeDefined();
    if (root) {
      expect(isChapterUnlocked(root, new Set())).toBe(true);
    }

    const withDeps = tree.find((n) => (n.unlockAfter?.length ?? 0) > 0);
    expect(withDeps).toBeDefined();
    if (withDeps && withDeps.unlockAfter) {
      expect(isChapterUnlocked(withDeps, new Set())).toBe(false);
      expect(isChapterUnlocked(withDeps, new Set(withDeps.unlockAfter))).toBe(
        true,
      );
    }

    for (const node of tree) {
      for (const tid of node.techniqueIds) {
        const pm = getPracticeModeForTechnique(tid);
        expect(pm.endless).toBe(true);
        expect(pm.modeId).toBe(`endless-practice:${tid}`);
      }
    }

    const known = new Set(listKnownTechniqueIds());
    for (const tid of Object.values(TECHNIQUE_IDS)) {
      expect(known.has(tid)).toBe(true);
      const chapters = getChaptersForTechnique(tid);
      expect(chapters.length).toBe(1);
      expect(chapters[0]!.techniqueIds).toContain(tid);
    }
  });

  it("query helpers align with tree content", () => {
    const tree = getCurriculumTree();
    for (const node of tree) {
      expect(getChapterById(node.id)).toBe(node);
    }
    expect(getChapterById("__no_such_chapter__")).toBeUndefined();

    const lows = getChaptersByTier("low");
    expect(lows.every((n) => n.tier === "low")).toBe(true);
    expect(lows.length).toBe(tree.filter((n) => n.tier === "low").length);

    const mids = getChaptersByTier("mid");
    expect(mids.every((n) => n.tier === "mid")).toBe(true);

    const highs = getChaptersByTier("high");
    expect(highs.every((n) => n.tier === "high")).toBe(true);
  });

  it("core + solver public exports remain importable next to curriculum", () => {
    const empty: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0));
    expect(isValidPlacement(empty, 0, 0, 1)).toBe(true);
    expect(Object.values(TECHNIQUE_IDS).length).toBeGreaterThan(0);
  });
});

import { test, expect } from "@playwright/test";
import {
  UnknownTechniqueIdError,
  getChapterById,
  getChaptersByTier,
  getChaptersForTechnique,
  getCurriculumTree,
  getPracticeModeForTechnique,
  isChapterUnlocked,
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
  validateUnlockGraph,
  type CurriculumNode,
} from "@/content/curriculum";
import { TECHNIQUE_IDS } from "@/lib/solver";

test.describe("Suduku tutorial curriculum (contract smoke)", () => {
  test("loads home", async ({ page }) => {
    // Cold dev compile on first navigation can exceed default timeouts under parallel load.
    await page.goto("/", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "数独" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("getCurriculumTree returns a stable array shape", () => {
    const tree = getCurriculumTree();
    expect(Array.isArray(tree)).toBe(true);
    for (const node of tree) {
      const n = node as CurriculumNode;
      expect(typeof n.id).toBe("string");
      expect(Array.isArray(n.techniqueIds)).toBe(true);
      expect(["low", "mid", "high"]).toContain(n.tier);
      if (n.unlockAfter !== undefined) {
        expect(Array.isArray(n.unlockAfter)).toBe(true);
        for (const ch of n.unlockAfter) {
          expect(typeof ch).toBe("string");
        }
      }
    }
  });

  test("getPracticeModeForTechnique: endless true and modeId tied to technique id", () => {
    const t = TECHNIQUE_IDS.NAKED_SINGLE;
    const pm = getPracticeModeForTechnique(t);
    expect(pm.endless).toBe(true);
    expect(pm.modeId).toBe(`endless-practice:${t}`);
  });

  test("getPracticeModeForTechnique: unknown technique throws", () => {
    expect(() => getPracticeModeForTechnique("__unknown__")).toThrow(
      UnknownTechniqueIdError,
    );
  });

  test("validateCurriculumTechniqueIds: production tree passes", () => {
    expect(validateCurriculumTechniqueIds(getCurriculumTree())).toEqual({
      ok: true,
    });
  });

  test("getCurriculumTree: non-empty and all three tiers present", () => {
    const tree = getCurriculumTree();
    expect(tree.length).toBeGreaterThan(0);
    const tiers = new Set(tree.map((n) => n.tier));
    expect(tiers.has("low")).toBe(true);
    expect(tiers.has("mid")).toBe(true);
    expect(tiers.has("high")).toBe(true);
  });

  test("validateCurriculumTechniqueIds: all TECHNIQUE_IDS in one chapter passes", () => {
    const nodes: CurriculumNode[] = [
      {
        id: "e2e-all-known",
        tier: "high",
        techniqueIds: [...Object.values(TECHNIQUE_IDS)],
      },
    ];
    expect(validateCurriculumTechniqueIds(nodes)).toEqual({ ok: true });
  });

  test("validateCurriculumTechniqueIds: unknown id yields structured errors", () => {
    const nodes: CurriculumNode[] = [
      {
        id: "e2e-bad",
        tier: "low",
        techniqueIds: ["__no_such_technique__"],
      },
    ];
    const r = validateCurriculumTechniqueIds(nodes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual([
        { chapterId: "e2e-bad", techniqueId: "__no_such_technique__" },
      ]);
    }
  });

  test("listKnownTechniqueIds matches solver registry size", () => {
    expect(listKnownTechniqueIds().length).toBe(
      Object.keys(TECHNIQUE_IDS).length,
    );
  });

  test("validateUnlockGraph: production tree is a valid DAG", () => {
    expect(validateUnlockGraph(getCurriculumTree())).toEqual({ ok: true });
  });

  test("isChapterUnlocked: first chapter with no prerequisites", () => {
    const tree = getCurriculumTree();
    const root = tree.find((n) => n.unlockAfter === undefined);
    expect(root).toBeDefined();
    if (root) {
      expect(isChapterUnlocked(root, new Set())).toBe(true);
    }
  });

  test("isChapterUnlocked: linear chain requires prior ids", () => {
    const tree = getCurriculumTree();
    const withDeps = tree.filter((n) => (n.unlockAfter?.length ?? 0) > 0);
    expect(withDeps.length).toBeGreaterThan(0);
    const node = withDeps[0]!;
    expect(isChapterUnlocked(node, new Set())).toBe(false);
    const done = new Set(node.unlockAfter!);
    expect(isChapterUnlocked(node, done)).toBe(true);
  });

  test("getChapterById / getChaptersForTechnique / getChaptersByTier", () => {
    const tree = getCurriculumTree();
    const first = tree[0]!;
    expect(getChapterById(first.id)).toBe(first);
    expect(getChapterById("__missing__")).toBeUndefined();

    const t = TECHNIQUE_IDS.NAKED_SINGLE;
    const forT = getChaptersForTechnique(t);
    expect(forT.length).toBe(1);
    expect(forT[0]!.techniqueIds).toContain(t);

    const lows = getChaptersByTier("low");
    expect(lows.length).toBeGreaterThan(0);
    expect(lows.every((n) => n.tier === "low")).toBe(true);
  });
});

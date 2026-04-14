import { test, expect } from "@playwright/test";
import {
  getCurriculumTree,
  getPracticeModeForTechnique,
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
  type CurriculumNode,
} from "@/content/curriculum";
import { TECHNIQUE_IDS } from "@/lib/solver";

test.describe("Suduku tutorial curriculum (contract smoke)", () => {
  test("loads home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "数独" })).toBeVisible();
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
    const t = "naked-single";
    const pm = getPracticeModeForTechnique(t);
    expect(pm.endless).toBe(true);
    expect(pm.modeId).toBe(`endless-practice:${t}`);
  });

  test("validateCurriculumTechniqueIds: empty tree passes", () => {
    expect(validateCurriculumTechniqueIds(getCurriculumTree())).toEqual({
      ok: true,
    });
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
});

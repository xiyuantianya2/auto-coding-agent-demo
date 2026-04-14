import { test, expect } from "@playwright/test";
import {
  getCurriculumTree,
  getPracticeModeForTechnique,
  type CurriculumNode,
} from "@/content/curriculum";

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
});

import { describe, expect, it } from "vitest";

import { TECHNIQUE_IDS } from "@/lib/solver";

import { getCurriculumTree } from "./curriculum";
import type { CurriculumNode } from "./types";
import { validateCurriculumTechniqueIds } from "./technique-validation";

describe("getCurriculumTree (task 3)", () => {
  it("passes validateCurriculumTechniqueIds (regression)", () => {
    expect(validateCurriculumTechniqueIds(getCurriculumTree())).toEqual({
      ok: true,
    });
  });

  it("is non-empty and includes low, mid, and high tiers", () => {
    const tree = getCurriculumTree();
    expect(tree.length).toBeGreaterThan(0);
    const tiers = new Set(tree.map((n) => n.tier));
    expect(tiers.has("low")).toBe(true);
    expect(tiers.has("mid")).toBe(true);
    expect(tiers.has("high")).toBe(true);
  });

  it("covers every TECHNIQUE_IDS entry exactly once across chapters", () => {
    const tree = getCurriculumTree();
    const seen = new Map<string, string>();
    for (const node of tree) {
      for (const tid of node.techniqueIds) {
        expect(seen.has(tid)).toBe(false);
        seen.set(tid, node.id);
      }
    }
    const all = new Set(Object.values(TECHNIQUE_IDS));
    expect(seen.size).toBe(all.size);
    for (const id of all) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it("returns a deep-frozen tree (mutations throw or are no-ops on arrays)", () => {
    const tree = getCurriculumTree();
    expect(Object.isFrozen(tree)).toBe(true);
    expect(() => {
      (tree as CurriculumNode[] & { push?: () => void }).push?.({
        id: "x",
        tier: "low",
        techniqueIds: [],
      });
    }).toThrow();
    const first = tree[0]!;
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.techniqueIds)).toBe(true);
  });
});

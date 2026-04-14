import { describe, expect, it } from "vitest";

import {
  getTechniqueCatalog,
  getUnlockGraph,
  type CurriculumTier,
  type TechniqueModule,
  type UnlockEdge,
} from "@/content/curriculum";
import { TechniqueIds } from "@/lib/solver";

describe("content/curriculum skeleton", () => {
  it("exports contract types (structural)", () => {
    const tier: CurriculumTier = "low";
    const mod: TechniqueModule = {
      id: "unique-candidate",
      tier,
      order: 0,
      practiceEndlessModeId: "practice-endless:unique-candidate",
      titleKey: "technique.uniqueCandidate.title",
    };
    expect(mod.id).toBe("unique-candidate");

    const edge: UnlockEdge = { techniqueId: "hidden-single", requires: [] };
    expect(edge.requires).toEqual([]);
  });

  it("getUnlockGraph returns an array (placeholder)", () => {
    const graph = getUnlockGraph();
    expect(Array.isArray(graph)).toBe(true);
    expect(graph).toEqual([]);
  });
});

describe("getTechniqueCatalog", () => {
  const tierRank: Record<CurriculumTier, number> = {
    low: 0,
    mid: 1,
    high: 2,
  };

  it("covers every registered TechniqueIds entry exactly once", () => {
    const registered = Object.values(TechniqueIds);
    const catalog = getTechniqueCatalog();

    expect(catalog.length).toBe(registered.length);

    const idSet = new Set(catalog.map((m) => m.id));
    expect(idSet.size).toBe(catalog.length);
    for (const id of registered) {
      expect(idSet.has(id)).toBe(true);
    }
  });

  it("has globally unique practiceEndlessModeId values", () => {
    const catalog = getTechniqueCatalog();
    const modeIds = catalog.map((m) => m.practiceEndlessModeId);
    expect(new Set(modeIds).size).toBe(modeIds.length);
  });

  it("returns a new array each call (shallow copy)", () => {
    const a = getTechniqueCatalog();
    const b = getTechniqueCatalog();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("is sorted by tier then order within tier", () => {
    const catalog = getTechniqueCatalog();
    for (let i = 1; i < catalog.length; i++) {
      const prev = catalog[i - 1]!;
      const cur = catalog[i]!;
      const tr = tierRank[cur.tier] - tierRank[prev.tier];
      expect(tr >= 0).toBe(true);
      if (tr === 0) {
        expect(cur.order).toBeGreaterThan(prev.order);
      }
    }
  });
});

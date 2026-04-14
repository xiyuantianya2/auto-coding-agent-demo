import { describe, expect, it } from "vitest";

import {
  getTechniqueCatalog,
  getUnlockGraph,
  type CurriculumTier,
  type TechniqueModule,
  type UnlockEdge,
} from "@/content/curriculum";

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

  it("getTechniqueCatalog returns an array (placeholder)", () => {
    const catalog = getTechniqueCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog).toEqual([]);
  });

  it("getUnlockGraph returns an array (placeholder)", () => {
    const graph = getUnlockGraph();
    expect(Array.isArray(graph)).toBe(true);
    expect(graph).toEqual([]);
  });
});

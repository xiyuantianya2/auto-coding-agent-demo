import { describe, expect, it } from "vitest";

import {
  getTechniqueCatalog,
  getTechniqueTutorialMetaMap,
  getUnlockGraph,
  validateCurriculum,
  type CurriculumTier,
  type TechniqueModule,
  type TechniqueTutorialMeta,
  type UnlockEdge,
} from "@/content/curriculum";
import { isRegisteredTechniqueId, TechniqueIds } from "@/lib/solver";

/**
 * 「扩展 id」占位：若某日在**本目录**引入未在 solver 登记的技巧键（仅文档/实验），在此列出，
 * 并由下方测试断言 `isRegisteredTechniqueId === false`。正常教学数据应继续只使用 `TechniqueIds` 真源，
 * 且仍须通过 `collectAllCurriculumTechniqueIdStrings` 的已登记断言。
 */
const EXTENSION_PLACEHOLDER_TECHNIQUE_IDS: readonly string[] = [];

function collectAllCurriculumTechniqueIdStrings(): string[] {
  const ids = new Set<string>();
  for (const m of getTechniqueCatalog()) {
    ids.add(m.id);
  }
  for (const e of getUnlockGraph()) {
    ids.add(e.techniqueId);
    for (const r of e.requires) {
      ids.add(r);
    }
  }
  return [...ids];
}

describe("@/lib/solver technique id contract (isRegisteredTechniqueId)", () => {
  it("every catalog + unlock-graph id is a registered solver technique id", () => {
    for (const id of collectAllCurriculumTechniqueIdStrings()) {
      expect(isRegisteredTechniqueId(id), `expected registered technique id, got: "${id}"`).toBe(true);
    }
  });

  it("extension placeholder ids (if any) are explicitly not solver-registered", () => {
    for (const id of EXTENSION_PLACEHOLDER_TECHNIQUE_IDS) {
      expect(isRegisteredTechniqueId(id), `placeholder must stay unregistered: "${id}"`).toBe(false);
    }
  });
});

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

  it("getUnlockGraph returns an array covering the catalog", () => {
    const graph = getUnlockGraph();
    expect(Array.isArray(graph)).toBe(true);
    expect(graph.length).toBe(getTechniqueCatalog().length);
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

  it("has no order gaps or duplicates within the same tier", () => {
    const catalog = getTechniqueCatalog();
    const byTier = new Map<CurriculumTier, number[]>();
    for (const m of catalog) {
      if (!byTier.has(m.tier)) byTier.set(m.tier, []);
      byTier.get(m.tier)!.push(m.order);
    }
    for (const orders of byTier.values()) {
      expect(new Set(orders).size).toBe(orders.length);
    }
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

describe("getUnlockGraph", () => {
  it("all techniqueId / requires members exist in catalog id set; no self-loops", () => {
    const catalog = getTechniqueCatalog();
    const ids = new Set(catalog.map((t) => t.id));
    const edges = getUnlockGraph();

    for (const e of edges) {
      expect(ids.has(e.techniqueId)).toBe(true);
      expect(e.requires.includes(e.techniqueId)).toBe(false);
      for (const r of e.requires) {
        expect(ids.has(r)).toBe(true);
      }
    }
  });

  it("forms a DAG (no cycles)", () => {
    const edges = getUnlockGraph();
    const nodes = new Set<string>();
    for (const e of edges) {
      nodes.add(e.techniqueId);
      for (const r of e.requires) nodes.add(r);
    }

    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n, []);
    for (const e of edges) {
      for (const r of e.requires) {
        adj.get(r)!.push(e.techniqueId);
      }
    }

    const state = new Map<string, "white" | "gray" | "black">();
    for (const n of nodes) state.set(n, "white");

    function dfs(u: string): boolean {
      state.set(u, "gray");
      for (const v of adj.get(u) ?? []) {
        if (state.get(v) === "gray") return true;
        if (state.get(v) === "white" && dfs(v)) return true;
      }
      state.set(u, "black");
      return false;
    }

    let hasCycle = false;
    for (const n of nodes) {
      if (state.get(n) === "white" && dfs(n)) {
        hasCycle = true;
        break;
      }
    }
    expect(hasCycle).toBe(false);
  });

  it("first technique (sorted entry point) has empty requires", () => {
    const catalog = getTechniqueCatalog();
    if (catalog.length === 0) {
      expect(getUnlockGraph()).toEqual([]);
      return;
    }
    const firstId = catalog[0].id;
    const first = getUnlockGraph().find((e) => e.techniqueId === firstId);
    expect(first).toBeDefined();
    expect(first!.requires).toEqual([]);
  });
});

describe("validateCurriculum", () => {
  it("returns no errors for the real catalog + graph", () => {
    const errors = validateCurriculum();
    expect(errors).toEqual([]);
  });

  it("detects duplicate practiceEndlessModeId", () => {
    const catalog: TechniqueModule[] = [
      { id: "a", tier: "low", order: 0, practiceEndlessModeId: "dup-mode", titleKey: "a" },
      { id: "b", tier: "low", order: 1, practiceEndlessModeId: "dup-mode", titleKey: "b" },
    ];
    const graph: UnlockEdge[] = [
      { techniqueId: "a", requires: [] },
      { techniqueId: "b", requires: ["a"] },
    ];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "DUPLICATE_MODE_ID")).toBe(true);
  });

  it("detects duplicate id in catalog", () => {
    const catalog: TechniqueModule[] = [
      { id: "x", tier: "low", order: 0, practiceEndlessModeId: "m1", titleKey: "x" },
      { id: "x", tier: "mid", order: 0, practiceEndlessModeId: "m2", titleKey: "x2" },
    ];
    const graph: UnlockEdge[] = [{ techniqueId: "x", requires: [] }];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "DUPLICATE_ID")).toBe(true);
  });

  it("detects graph referencing unknown techniqueId", () => {
    const catalog: TechniqueModule[] = [
      { id: "a", tier: "low", order: 0, practiceEndlessModeId: "m1", titleKey: "a" },
    ];
    const graph: UnlockEdge[] = [
      { techniqueId: "a", requires: [] },
      { techniqueId: "ghost", requires: [] },
    ];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "GRAPH_UNKNOWN_TECHNIQUE")).toBe(true);
  });

  it("detects graph edge requiring unknown id", () => {
    const catalog: TechniqueModule[] = [
      { id: "a", tier: "low", order: 0, practiceEndlessModeId: "m1", titleKey: "a" },
    ];
    const graph: UnlockEdge[] = [{ techniqueId: "a", requires: ["missing-dep"] }];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "GRAPH_UNKNOWN_REQUIRES")).toBe(true);
  });

  it("detects duplicate order within same tier", () => {
    const catalog: TechniqueModule[] = [
      { id: "a", tier: "mid", order: 0, practiceEndlessModeId: "m1", titleKey: "a" },
      { id: "b", tier: "mid", order: 0, practiceEndlessModeId: "m2", titleKey: "b" },
    ];
    const graph: UnlockEdge[] = [
      { techniqueId: "a", requires: [] },
      { techniqueId: "b", requires: ["a"] },
    ];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "DUPLICATE_ORDER")).toBe(true);
  });

  it("detects catalog technique missing from graph", () => {
    const catalog: TechniqueModule[] = [
      { id: "a", tier: "low", order: 0, practiceEndlessModeId: "m1", titleKey: "a" },
      { id: "b", tier: "low", order: 1, practiceEndlessModeId: "m2", titleKey: "b" },
    ];
    const graph: UnlockEdge[] = [{ techniqueId: "a", requires: [] }];
    const errors = validateCurriculum(catalog, graph);
    expect(errors.some((e) => e.code === "CATALOG_NOT_IN_GRAPH")).toBe(true);
  });

  it("returns empty array for valid custom data", () => {
    const catalog: TechniqueModule[] = [
      { id: "t1", tier: "low", order: 0, practiceEndlessModeId: "pm1", titleKey: "t1.title" },
      { id: "t2", tier: "low", order: 1, practiceEndlessModeId: "pm2", titleKey: "t2.title" },
    ];
    const graph: UnlockEdge[] = [
      { techniqueId: "t1", requires: [] },
      { techniqueId: "t2", requires: ["t1"] },
    ];
    expect(validateCurriculum(catalog, graph)).toEqual([]);
  });
});

function assertTutorialMetaKeysInCatalog(
  map: Readonly<Record<string, TechniqueTutorialMeta>>,
  catalogIds: Set<string>,
): void {
  for (const techniqueId of Object.keys(map)) {
    expect(catalogIds.has(techniqueId)).toBe(true);
  }
}

describe("technique tutorial meta (bodyKey / stepHighlightPresetKey)", () => {
  it("every key in getTechniqueTutorialMetaMap exists in technique catalog", () => {
    const catalogIds = new Set(getTechniqueCatalog().map((m) => m.id));
    assertTutorialMetaKeysInCatalog(getTechniqueTutorialMetaMap(), catalogIds);
  });

  it("empty map does not fail key-vs-catalog check", () => {
    const catalogIds = new Set(getTechniqueCatalog().map((m) => m.id));
    const empty: Readonly<Record<string, TechniqueTutorialMeta>> = {};
    expect(() => assertTutorialMetaKeysInCatalog(empty, catalogIds)).not.toThrow();
  });
});

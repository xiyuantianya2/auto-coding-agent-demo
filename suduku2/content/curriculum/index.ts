/**
 * 教学大纲与专项映射（纯数据与查询，无 UI）。
 *
 * **技巧 id 约定**：`TechniqueModule.id` 与 `getUnlockGraph` 中的 `techniqueId` / `requires`
 * 必须使用与 {@link import("@/lib/solver").TechniqueIds} 及 {@link import("@/lib/solver").TechniqueId}
 * 一致的字符串字面量（与求解器登记对齐）。**禁止**自造与求解器未登记不同的异名 id。
 *
 * 与 **hint-system** / **puzzle-generator** 的交叉引用：凡涉及技巧名或 `TechniqueId` 字符串，均以
 * `lib/solver/technique-ids.ts` 的 {@link TechniqueIds} 为唯一真源；出题档位、提示返回的 `technique`
 * 与本目录中的 `id` 必须可对上同一登记集合。
 *
 * **扩展 id 策略**：当前目录**不**保留「未在求解器登记的占位技巧 id」。若未来需要教学占位或实验位，
 * 须在数据旁显式列出并在 Vitest 中单独断言（例如预期 `isRegisteredTechniqueId === false`），**禁止**
 * 依赖静默拼写错误通过字符串比对混入目录。
 *
 * 本模块不追求「最少章节数」「最短解锁路径」等极限指标。
 *
 * 讲解文案键与步骤高亮预设见 {@link getTechniqueTutorialMetaMap} / {@link TECHNIQUE_TUTORIAL_META}（并列数据，不扩展 {@link TechniqueModule}）。
 */

import { TechniqueIds } from "@/lib/solver";

/** 教学章节分档：低 / 中 / 高阶。 */
export type CurriculumTier = "low" | "mid" | "high";

/**
 * 单条技巧在教学大纲中的元数据（与 `module-plan.json` 契约一致）。
 * 运行时 `id` 字符串应对齐 {@link import("@/lib/solver").TechniqueIds} / {@link import("@/lib/solver").TechniqueId}。
 */
export type TechniqueModule = {
  id: string;
  tier: CurriculumTier;
  order: number;
  practiceEndlessModeId: string;
  titleKey: string;
};

export type UnlockEdge = {
  techniqueId: string;
  requires: string[];
};

export type {
  TechniqueTutorialMeta,
  TechniqueTutorialMetaMap,
} from "./technique-tutorial-meta";
export { getTechniqueTutorialMetaMap, TECHNIQUE_TUTORIAL_META } from "./technique-tutorial-meta";

/**
 * 类型-only 再导出：标注本模块**运行时不依赖**具体 9×9 盘面；仅便于与上层在类型层对齐 `GameState` 等契约。
 * 不引入 `core-model` 的运行时值或序列化副作用。
 */
export type { CellState, GameState, Grid9 } from "@/lib/core";

/** 与 {@link CurriculumTier} 一致的排序权重（低 → 中 → 高）。 */
const TIER_RANK: Record<CurriculumTier, number> = {
  low: 0,
  mid: 1,
  high: 2,
};

/**
 * 静态技巧目录（与 `lib/solver/technique-ids.ts` 当前登记一一对应）。
 *
 * 分档与 `lib/generator/tier-profiles` 直觉对齐：低阶对应裸单/隐单；中阶加入宫内指向、行列摒除与数对；
 * 高阶为三数组与 X-Wing。同档内 `order` 单调递增、无重复。
 */
const TECHNIQUE_CATALOG_SOURCE: readonly TechniqueModule[] = [
  {
    id: TechniqueIds.UniqueCandidate,
    tier: "low",
    order: 0,
    practiceEndlessModeId: "practice-endless:unique-candidate",
    titleKey: "technique.uniqueCandidate.title",
  },
  {
    id: TechniqueIds.HiddenSingle,
    tier: "low",
    order: 1,
    practiceEndlessModeId: "practice-endless:hidden-single",
    titleKey: "technique.hiddenSingle.title",
  },
  {
    id: TechniqueIds.Pointing,
    tier: "mid",
    order: 0,
    practiceEndlessModeId: "practice-endless:pointing",
    titleKey: "technique.pointing.title",
  },
  {
    id: TechniqueIds.BoxLineReduction,
    tier: "mid",
    order: 1,
    practiceEndlessModeId: "practice-endless:box-line-reduction",
    titleKey: "technique.boxLineReduction.title",
  },
  {
    id: TechniqueIds.NakedPair,
    tier: "mid",
    order: 2,
    practiceEndlessModeId: "practice-endless:naked-pair",
    titleKey: "technique.nakedPair.title",
  },
  {
    id: TechniqueIds.HiddenPair,
    tier: "mid",
    order: 3,
    practiceEndlessModeId: "practice-endless:hidden-pair",
    titleKey: "technique.hiddenPair.title",
  },
  {
    id: TechniqueIds.NakedTriple,
    tier: "high",
    order: 0,
    practiceEndlessModeId: "practice-endless:naked-triple",
    titleKey: "technique.nakedTriple.title",
  },
  {
    id: TechniqueIds.HiddenTriple,
    tier: "high",
    order: 1,
    practiceEndlessModeId: "practice-endless:hidden-triple",
    titleKey: "technique.hiddenTriple.title",
  },
  {
    id: TechniqueIds.XWing,
    tier: "high",
    order: 2,
    practiceEndlessModeId: "practice-endless:x-wing",
    titleKey: "technique.xWing.title",
  },
];

/**
 * 返回按 `tier`（低→中→高）再按同档 `order` 排序的技巧目录。
 *
 * **不可变性**：每次调用返回**新数组**（浅拷贝条目引用）；请勿原地修改返回值。
 */
export function getTechniqueCatalog(): TechniqueModule[] {
  return [...TECHNIQUE_CATALOG_SOURCE].sort((a, b) => {
    const td = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (td !== 0) {
      return td;
    }
    return a.order - b.order;
  });
}

/**
 * 渐进解锁依赖图（有向无环）。
 *
 * 策略：全目录按 tier（低→中→高）→ order → id 排序后形成单链，
 * 每项依赖排序中的前一项；首项 `requires: []` 表示默认解锁 / 教程入口。
 *
 * 与 `server-api` 的衔接：服务端可在此图允许的"下一跳"里
 * 更新 `techniques[id].unlocked` 持久化状态。
 */
export function getUnlockGraph(): UnlockEdge[] {
  const sorted = getTechniqueCatalog();
  return sorted.map((t, i) => ({
    techniqueId: t.id,
    requires: i === 0 ? [] : [sorted[i - 1].id],
  }));
}

// ── Runtime consistency validator ────────────────────────────────

export type CurriculumValidationError = {
  code: string;
  message: string;
};

/**
 * Validates cross-referential integrity of the curriculum data.
 *
 * Checks performed (single linear scan, synchronous, typically < 1 ms):
 * 1. `getTechniqueCatalog` ↔ `getUnlockGraph` cross-reference closure
 * 2. `practiceEndlessModeId` uniqueness
 * 3. No duplicate `order` within the same `tier`
 * 4. No duplicate `id` in catalog
 *
 * @returns An array of validation errors (empty = valid).
 */
export function validateCurriculum(
  catalog: TechniqueModule[] = getTechniqueCatalog(),
  graph: UnlockEdge[] = getUnlockGraph(),
): CurriculumValidationError[] {
  const errors: CurriculumValidationError[] = [];
  const catalogIds = new Set(catalog.map((m) => m.id));

  // 1. Duplicate id in catalog
  if (catalogIds.size !== catalog.length) {
    const seen = new Set<string>();
    for (const m of catalog) {
      if (seen.has(m.id)) {
        errors.push({ code: "DUPLICATE_ID", message: `Duplicate technique id: "${m.id}"` });
      }
      seen.add(m.id);
    }
  }

  // 2. practiceEndlessModeId uniqueness
  const modeIdsSeen = new Set<string>();
  for (const m of catalog) {
    if (modeIdsSeen.has(m.practiceEndlessModeId)) {
      errors.push({
        code: "DUPLICATE_MODE_ID",
        message: `Duplicate practiceEndlessModeId: "${m.practiceEndlessModeId}"`,
      });
    }
    modeIdsSeen.add(m.practiceEndlessModeId);
  }

  // 3. No duplicate order within the same tier
  const orderByTier = new Map<CurriculumTier, Set<number>>();
  for (const m of catalog) {
    if (!orderByTier.has(m.tier)) orderByTier.set(m.tier, new Set());
    const orders = orderByTier.get(m.tier)!;
    if (orders.has(m.order)) {
      errors.push({
        code: "DUPLICATE_ORDER",
        message: `Duplicate order ${m.order} in tier "${m.tier}"`,
      });
    }
    orders.add(m.order);
  }

  // 4. Cross-reference: every graph techniqueId must exist in catalog
  for (const edge of graph) {
    if (!catalogIds.has(edge.techniqueId)) {
      errors.push({
        code: "GRAPH_UNKNOWN_TECHNIQUE",
        message: `Unlock graph references unknown techniqueId: "${edge.techniqueId}"`,
      });
    }
    for (const req of edge.requires) {
      if (!catalogIds.has(req)) {
        errors.push({
          code: "GRAPH_UNKNOWN_REQUIRES",
          message: `Unlock graph edge for "${edge.techniqueId}" requires unknown id: "${req}"`,
        });
      }
    }
  }

  // 5. Every catalog id should appear in graph
  const graphTechniqueIds = new Set(graph.map((e) => e.techniqueId));
  for (const id of catalogIds) {
    if (!graphTechniqueIds.has(id)) {
      errors.push({
        code: "CATALOG_NOT_IN_GRAPH",
        message: `Catalog technique "${id}" has no entry in unlock graph`,
      });
    }
  }

  return errors;
}

/**
 * 教学大纲与专项映射（纯数据与查询，无 UI）。
 *
 * **技巧 id 约定**：`TechniqueModule.id` 与 `getUnlockGraph` 中的 `techniqueId` / `requires`
 * 必须使用与 {@link import("@/lib/solver").TechniqueIds} 及 {@link import("@/lib/solver").TechniqueId}
 * 一致的字符串字面量（与求解器登记对齐）。**禁止**自造与求解器未登记不同的异名 id。
 *
 * 本模块不追求「最少章节数」「最短解锁路径」等极限指标；后续任务再填充目录与解锁图数据。
 */

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

/** 占位：首版返回空目录，后续任务填充并与 `TechniqueIds` 全覆盖对齐。 */
export function getTechniqueCatalog(): TechniqueModule[] {
  return [];
}

/** 占位：首版返回空图，后续任务填充渐进解锁关系（有向无环）。 */
export function getUnlockGraph(): UnlockEdge[] {
  return [];
}

/**
 * 教学页「短讲解」文案键与「步骤高亮预设」键（按技巧 id 索引）。
 *
 * 与 {@link TechniqueModule} 并列维护，不修改最小契约；首版可大部分空缺。
 * 仅静态常量，同步读取，无 UI。
 */

import { TechniqueIds } from "@/lib/solver";

/** 单条技巧的可选讲解与高亮预设引用（i18n / 预设 id）。 */
export type TechniqueTutorialMeta = {
  bodyKey?: string;
  stepHighlightPresetKey?: string;
};

export type TechniqueTutorialMetaMap = Readonly<Record<string, TechniqueTutorialMeta>>;

/**
 * 按 `techniqueId` 索引的可选数据。键必须为技巧目录中存在的 `id`。
 * 未列出的技巧视为无预设（调用方可按 `techniqueId` 回退默认）。
 */
export const TECHNIQUE_TUTORIAL_META: TechniqueTutorialMetaMap = Object.freeze({
  // 示例：占位键名，后续与 i18n / 高亮预设表对齐；可随内容增量扩充。
  [TechniqueIds.UniqueCandidate]: {
    bodyKey: "curriculum.tutorial.uniqueCandidate.body",
    stepHighlightPresetKey: "curriculum.highlight.uniqueCandidate.default",
  },
});

/**
 * 返回只读 map（与 {@link TECHNIQUE_TUTORIAL_META} 同一引用），供教学页同步查询。
 */
export function getTechniqueTutorialMetaMap(): TechniqueTutorialMetaMap {
  return TECHNIQUE_TUTORIAL_META;
}

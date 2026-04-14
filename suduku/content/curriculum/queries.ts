/**
 * 只读查询：便于 client-ui / server-api 按 id、技巧或 tier 检索章节。
 */

import { getCurriculumTree } from "./curriculum";
import type { ChapterId, CurriculumNode, CurriculumTier } from "./types";

/** 按章节 id 查找；不存在则 `undefined`。 */
export function getChapterById(id: ChapterId): CurriculumNode | undefined {
  return getCurriculumTree().find((n) => n.id === id);
}

/** 返回绑定该技巧 id 的全部章节（顺序与树中一致）。 */
export function getChaptersForTechnique(techniqueId: string): CurriculumNode[] {
  return getCurriculumTree().filter((n) => n.techniqueIds.includes(techniqueId));
}

/** 按 tier 筛选章节（顺序与树中一致）。 */
export function getChaptersByTier(tier: CurriculumTier): CurriculumNode[] {
  return getCurriculumTree().filter((n) => n.tier === tier);
}

/**
 * 专项无尽练习与 `modeId` 约定。
 *
 * **modeId 格式**（可序列化、稳定）：`endless-practice:<techniqueId>`，其中 `<techniqueId>`
 * 必须为 {@link TECHNIQUE_IDS} 中的值。该前缀下映射为**单射**（一技巧一 modeId）。
 *
 * **未知 `techniqueId`**：抛出 {@link UnknownTechniqueIdError}（与 `validateCurriculumTechniqueIds`
 * 返回结构化错误相对照，本 API 为单次查询故用异常固定失败路径）。
 */

import type { ChapterId, CurriculumTier } from "./types";
import { getCurriculumTree } from "./curriculum";
import { isKnownTechniqueId } from "./technique-validation";

/** 与 {@link getPracticeModeForTechnique} 返回的 `modeId` 使用同一前缀。 */
export const PRACTICE_MODE_ID_PREFIX = "endless-practice:" as const;

const MODE_ID_PATTERN = /^endless-practice:[a-z0-9-]+$/;

export class UnknownTechniqueIdError extends Error {
  readonly name = "UnknownTechniqueIdError";

  constructor(readonly techniqueId: string) {
    super(`Unknown technique id for practice mode: ${techniqueId}`);
  }
}

/**
 * 专项无尽模式描述。仅对引擎已知 {@link TECHNIQUE_IDS} 返回；未知 id 抛错。
 */
export function getPracticeModeForTechnique(techniqueId: string): {
  modeId: string;
  endless: true;
} {
  if (!isKnownTechniqueId(techniqueId)) {
    throw new UnknownTechniqueIdError(techniqueId);
  }
  return {
    modeId: `${PRACTICE_MODE_ID_PREFIX}${techniqueId}`,
    endless: true,
  };
}

/** 文档化用的 modeId 格式校验（测试与外部序列化校验可复用）。 */
export function isValidPracticeModeId(modeId: string): boolean {
  return MODE_ID_PATTERN.test(modeId);
}

/**
 * 按章节列出该章内各技巧对应的专项无尽练习（顺序与节点 `techniqueIds` 一致）。
 */
export function listPracticeModesForChapter(chapterId: ChapterId): Array<{
  techniqueId: string;
  modeId: string;
  endless: true;
}> {
  const node = getCurriculumTree().find((n) => n.id === chapterId);
  if (!node) {
    return [];
  }
  return node.techniqueIds.map((techniqueId) => ({
    techniqueId,
    ...getPracticeModeForTechnique(techniqueId),
  }));
}

/**
 * 按阶位列出大纲中该档全部「章节 × 技巧」的专项无尽练习映射（树遍历顺序）。
 */
export function listPracticeModesByTier(tier: CurriculumTier): Array<{
  chapterId: ChapterId;
  techniqueId: string;
  modeId: string;
  endless: true;
}> {
  const out: Array<{
    chapterId: ChapterId;
    techniqueId: string;
    modeId: string;
    endless: true;
  }> = [];
  for (const node of getCurriculumTree()) {
    if (node.tier !== tier) continue;
    for (const techniqueId of node.techniqueIds) {
      const pm = getPracticeModeForTechnique(techniqueId);
      out.push({
        chapterId: node.id,
        techniqueId,
        modeId: pm.modeId,
        endless: pm.endless,
      });
    }
  }
  return out;
}

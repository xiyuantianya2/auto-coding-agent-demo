/**
 * 技巧 id 校验：已知集合唯一来源于 `lib/solver` 的 {@link TECHNIQUE_IDS}，
 * 避免在教学内容中维护与引擎无关的平行字符串表。
 *
 * **未知 `techniqueId` 行为**：`validateCurriculumTechniqueIds` 返回
 * `{ ok: false, errors: [...] }`（不抛异常）。
 */

import {
  TECHNIQUE_IDS,
  TECHNIQUE_RESOLUTION_ORDER,
  type KnownTechniqueId,
} from "@/lib/solver";

const KNOWN_TECHNIQUE_ID_SET = new Set<string>(Object.values(TECHNIQUE_IDS));

/**
 * 是否为引擎 {@link TECHNIQUE_IDS} 登记的技巧 id（与 {@link validateCurriculumTechniqueIds} 使用同一集合）。
 */
export function isKnownTechniqueId(
  techniqueId: string,
): techniqueId is KnownTechniqueId {
  return KNOWN_TECHNIQUE_ID_SET.has(techniqueId);
}

export type CurriculumTechniqueValidationError = {
  chapterId: string;
  techniqueId: string;
};

export type CurriculumTechniqueValidationResult =
  | { ok: true }
  | { ok: false; errors: CurriculumTechniqueValidationError[] };

/**
 * 引擎登记的全部技巧 id（顺序与求解优先级 {@link TECHNIQUE_RESOLUTION_ORDER} 一致）。
 */
export function listKnownTechniqueIds(): readonly KnownTechniqueId[] {
  return TECHNIQUE_RESOLUTION_ORDER as readonly KnownTechniqueId[];
}

/**
 * 检查大纲节点中的 `techniqueIds` 是否均为引擎已知 id。
 * 若存在未知 id，返回 `{ ok: false, errors }`，其中每项标明所在章节与非法 id。
 */
export function validateCurriculumTechniqueIds(
  nodes: ReadonlyArray<{ id: string; techniqueIds: readonly string[] }>,
): CurriculumTechniqueValidationResult {
  const errors: CurriculumTechniqueValidationError[] = [];
  for (const node of nodes) {
    for (const techniqueId of node.techniqueIds) {
      if (!KNOWN_TECHNIQUE_ID_SET.has(techniqueId)) {
        errors.push({ chapterId: node.id, techniqueId });
      }
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * 教学大纲与专项映射（骨架）。
 * 完整章节数据与校验见后续任务；此处仅稳定类型与公开 API 签名。
 */

export type ChapterId = string;

export type CurriculumTier = "low" | "mid" | "high";

export type CurriculumNode = {
  id: ChapterId;
  techniqueIds: string[];
  tier: CurriculumTier;
  unlockAfter?: ChapterId[];
};

/** 占位：后续任务填入完整树；当前保证签名与返回类型稳定。 */
export function getCurriculumTree(): CurriculumNode[] {
  return [];
}

export {
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
  type CurriculumTechniqueValidationError,
  type CurriculumTechniqueValidationResult,
} from "./technique-validation";

const PRACTICE_MODE_PREFIX = "endless-practice:";

/** 占位：与 techniqueId 绑定的稳定 modeId；完整规范见任务 5。 */
export function getPracticeModeForTechnique(techniqueId: string): {
  modeId: string;
  endless: true;
} {
  return {
    modeId: `${PRACTICE_MODE_PREFIX}${techniqueId}`,
    endless: true,
  };
}

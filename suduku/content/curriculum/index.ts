/**
 * 教学大纲与专项映射：章节树见 `./curriculum`，技巧 id 校验见 `./technique-validation`。
 */

export type ChapterId = string;

export type CurriculumTier = "low" | "mid" | "high";

export type CurriculumNode = {
  id: ChapterId;
  techniqueIds: string[];
  tier: CurriculumTier;
  unlockAfter?: ChapterId[];
};

export { getCurriculumTree } from "./curriculum";

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

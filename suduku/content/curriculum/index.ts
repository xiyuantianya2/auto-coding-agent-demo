/**
 * 教学大纲与专项映射：章节树见 `./curriculum`，技巧 id 校验见 `./technique-validation`。
 */

export type { ChapterId, CurriculumNode, CurriculumTier } from "./types";

export { getCurriculumTree } from "./curriculum";

export {
  isKnownTechniqueId,
  listKnownTechniqueIds,
  validateCurriculumTechniqueIds,
  type CurriculumTechniqueValidationError,
  type CurriculumTechniqueValidationResult,
} from "./technique-validation";

export {
  isChapterUnlocked,
  validateUnlockGraph,
  type UnlockGraphCycleError,
  type UnlockGraphValidationError,
  type UnlockGraphValidationResult,
} from "./unlock-graph";

export {
  PRACTICE_MODE_ID_PREFIX,
  UnknownTechniqueIdError,
  getPracticeModeForTechnique,
  isValidPracticeModeId,
  listPracticeModesByTier,
  listPracticeModesForChapter,
} from "./practice-mode";

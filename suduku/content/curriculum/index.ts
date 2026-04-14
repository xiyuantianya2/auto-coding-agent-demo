/**
 * 教学大纲与专项映射（`module-plan.json` → `tutorial-curriculum`）— **对外契约已冻结**，
 * 与 `interface` 字段名一致：
 *
 * - `type ChapterId = string`
 * - `type CurriculumNode = { id; techniqueIds; tier: 'low'|'mid'|'high'; unlockAfter? }`
 *   （实现中 `tier` 为别名 {@link CurriculumTier}）
 * - `getCurriculumTree(): CurriculumNode[]`
 * - `getPracticeModeForTechnique(techniqueId): { modeId; endless: true }`
 *
 * **本仓库无** suduku 级 `architecture.md`；扩展说明见本文件与各子文件注释。
 *
 * ---
 * **数据位置**：章节正文在 {@link "./curriculum" `./curriculum.ts`} 的 `CURRICULUM_NODES_RAW`
 *（加载时经技巧与解锁图校验后深冻结，由 `getCurriculumTree` 返回）。
 *
 * **新增章节**：在 `curriculum.ts` 的 `CURRICULUM_NODES_RAW` 中追加节点—`id` 用稳定 kebab-case；
 * `techniqueIds` 仅使用 `lib/solver` 公开 `TECHNIQUE_IDS` 中的值；按需设置 `unlockAfter` 指向已有
 * `ChapterId`。保存后跑 `npm test` / `npm run lint` 回归。
 *
 * ---
 * **导出清单（module-plan 必选 + 本模块其余公开 API，供 client-ui / server 对接）**
 *
 * | 符号 | 说明 |
 * |------|------|
 * | `ChapterId`, `CurriculumNode`, `CurriculumTier` | 类型 |
 * | `getCurriculumTree` | 教学树 |
 * | `getPracticeModeForTechnique` | 技巧 → 专项无尽 `modeId` |
 * | `isKnownTechniqueId`, `listKnownTechniqueIds`, `validateCurriculumTechniqueIds`, … | 技巧校验 |
 * | `validateUnlockGraph`, `isChapterUnlocked`, … | 解锁图与判定 |
 * | `PRACTICE_MODE_ID_PREFIX`, `UnknownTechniqueIdError`, `isValidPracticeModeId`, … | 练习模式 |
 * | `getChapterById`, `getChaptersForTechnique`, `getChaptersByTier` | 只读查询 |
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

export {
  getChapterById,
  getChaptersByTier,
  getChaptersForTechnique,
} from "./queries";

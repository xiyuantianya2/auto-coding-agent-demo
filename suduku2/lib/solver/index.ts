/**
 * **求解引擎**（`solver-engine`）公开入口。
 *
 * 下游（`puzzle-generator`、`hint-system`、`notes-logic` 等）应自本文件引用
 *（例如 `import { … } from "@/lib/solver"`），避免深路径耦合。
 *
 * ## 与 `module-plan.json` 对齐的契约 API
 *
 * - **类型**：{@link TechniqueId}（可扩展字符串；已知 id 见 {@link KnownTechniqueId}）、
 *   {@link SolveStep}、{@link CandidatesGrid}（及单格 {@link CandidatesCell}）、{@link HighlightKind}。
 * - **技巧常量表**：{@link TechniqueIds}（与教学/提示系统交叉引用）。
 * - **函数**：{@link computeCandidates}、{@link findApplicableSteps}、{@link scoreDifficulty}。
 *
 * `SolveStep.highlights[].ref` 与 `eliminations` 的推荐 JSON 形状见 {@link SolveStep} 上的说明。
 *
 * ## 扩展 API（可选）
 *
 * 低/中/高阶分层检测、去重键、难度权重查询等供高级调用或测试；非 `module-plan` 最小契约所必需。
 *
 * @module @/lib/solver
 */

// --- module-plan 契约：类型 ---
export type { TechniqueId, KnownTechniqueId } from "./technique-ids";
export { TechniqueIds } from "./technique-ids";
export type {
  CandidatesCell,
  CandidatesGrid,
  HighlightKind,
  SolveStep,
} from "./types";

// --- module-plan 契约：核心函数 ---
export { computeCandidates } from "./candidates";
export { findApplicableSteps } from "./find-applicable-steps";
export {
  DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT,
  scoreDifficulty,
  techniqueWeight,
} from "./score-difficulty";
export type { DifficultyScoreResult } from "./score-difficulty";

// --- 扩展：聚合入口元数据与分层技巧 ---
export {
  canonicalStepDedupKey,
  isRegisteredTechniqueId,
  MAX_FIND_APPLICABLE_EMITTED_STEPS,
  MAX_FIND_APPLICABLE_MS,
} from "./find-applicable-steps";
export {
  findLowTierApplicableSteps,
  findLowTierStepsFromCandidates,
} from "./low-tier";
export {
  findMidTierApplicableSteps,
  findMidTierStepsFromCandidates,
  type MidTierFromCandidatesOptions,
} from "./mid-tier";
export {
  findHighTierApplicableSteps,
  findHighTierStepsFromCandidates,
  MAX_ELAPSED_MS_HI,
  MAX_HI_EMITTED_STEPS,
  MAX_HI_PATTERN_PROBES,
} from "./high-tier";
export type { HighTierOptions } from "./high-tier";

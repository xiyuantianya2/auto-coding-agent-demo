/**
 * @packageDocumentation
 * 「求解与技巧引擎」模块：维护候选、识别技巧、输出可解释步骤与难度相关输入。
 *
 * **与 `lib/core` 的关系**
 *
 * - 仅通过 `@/lib/core` **公开入口**消费 `GameState`、`Grid9` 及 `isValidPlacement` 等规则（候选计算在内部间接使用），不反向依赖 UI / 存档。
 * - 分析在**给定盘面**上进行；**不负责出题、不验证题目唯一解**；题目生成与唯一性属于 `puzzle-generator` 等上游模块。
 *
 * **公开 API** 与仓库根 `module-plan.json` 中 `solver-engine` 的 `interface` 及下列具名导出一致（`TechniqueId`、`SolveStep`、`CandidatesGrid`、`CandidateElimination`、`TECHNIQUE_IDS`、`computeCandidates`、`findTechniques`、`scoreDifficulty` 等）。
 */

import type { GameState } from "../core";
import { findTechniques as findTechniquesImpl } from "./find-techniques";
import { scoreDifficulty as scoreDifficultyImpl } from "./score-difficulty";
import type { SolveStep } from "./types";

export type {
  CandidateElimination,
  CandidatesGrid,
  HighlightCandidateRef,
  HighlightCellRef,
  HighlightUnitRef,
  SolveStep,
  SolveStepHighlight,
  TechniqueId,
} from "./types";

export {
  TECHNIQUE_IDS,
  TECHNIQUE_RESOLUTION_ORDER,
  type KnownTechniqueId,
} from "./techniques";
export {
  ELIMINATION_TECHNIQUE_PIPELINE,
  type EliminationTechniqueDetector,
} from "./technique-registry";
export { TECHNIQUE_WEIGHT } from "./score-difficulty";
export { skyscraperFromCandidates } from "./technique-skyscraper";
export { xyWingFromCandidates } from "./technique-xy-wing";
export { createEmptyCandidatesGrid } from "./candidates";
export {
  CandidatesComputationError,
  type CandidatesComputationErrorDetails,
  type CandidatesComputationErrorKind,
  candidatesGridToSnapshot,
  computeCandidates,
} from "./compute-candidates";

/**
 * 枚举当前盘面可观察的技巧步骤（含裸单 / 隐单、裸隐数对、pointing / claiming、鱼形、Skyscraper、XY-Wing 等；见 {@link ELIMINATION_TECHNIQUE_PIPELINE}）。
 */
export function findTechniques(state: GameState): SolveStep[] {
  return findTechniquesImpl(state);
}

/**
 * 依据技巧步骤估计难度分数（启发式）；公式与权重表见 `./score-difficulty`。
 */
export function scoreDifficulty(state: GameState, steps: SolveStep[]): number {
  return scoreDifficultyImpl(state, steps);
}

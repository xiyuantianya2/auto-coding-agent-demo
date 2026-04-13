/**
 * @packageDocumentation
 * 「求解与技巧引擎」模块：维护候选、识别技巧、输出可解释步骤与难度相关输入。
 * 仅依赖 `@/lib/core` 公开类型与规则工具；**不负责出题**。
 *
 * 公开形状与 `module-plan.json` 中 solver-engine 的 `interface` 一致。
 */

import type { GameState } from "../core";
import { findTechniques as findTechniquesImpl } from "./find-techniques";
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

export { TECHNIQUE_IDS, type KnownTechniqueId } from "./techniques";
export { createEmptyCandidatesGrid } from "./candidates";
export {
  CandidatesComputationError,
  type CandidatesComputationErrorDetails,
  type CandidatesComputationErrorKind,
  candidatesGridToSnapshot,
  computeCandidates,
} from "./compute-candidates";

/**
 * 枚举当前盘面可观察的技巧步骤（任务 3 起实现：裸单 / 隐单；后续任务扩展更多技法）。
 */
export function findTechniques(state: GameState): SolveStep[] {
  return findTechniquesImpl(state);
}

/**
 * 依据技巧步骤估计难度分数（任务 7 实现）。占位实现返回 `0`。
 */
export function scoreDifficulty(state: GameState, steps: SolveStep[]): number {
  void state;
  void steps;
  return 0;
}

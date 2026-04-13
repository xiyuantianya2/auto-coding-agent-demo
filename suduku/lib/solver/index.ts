/**
 * @packageDocumentation
 * 「求解与技巧引擎」模块：维护候选、识别技巧、输出可解释步骤与难度相关输入。
 * 仅依赖 `@/lib/core` 公开类型与规则工具；**不负责出题**。
 *
 * 公开形状与 `module-plan.json` 中 solver-engine 的 `interface` 一致。
 */

import type { GameState } from "@/lib/core";
import { createEmptyCandidatesGrid } from "./candidates";
import type { CandidatesGrid, SolveStep } from "./types";

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

/**
 * 计算当前盘面下每格候选（任务 2 实现）。占位实现返回空候选网格，不读取 `state`。
 */
export function computeCandidates(state: GameState): CandidatesGrid {
  void state;
  return createEmptyCandidatesGrid();
}

/**
 * 枚举当前一步可应用的技巧实例（任务 3–7 实现）。占位实现返回空数组。
 */
export function findTechniques(state: GameState): SolveStep[] {
  void state;
  return [];
}

/**
 * 依据技巧步骤估计难度分数（任务 7 实现）。占位实现返回 `0`。
 */
export function scoreDifficulty(state: GameState, steps: SolveStep[]): number {
  void state;
  void steps;
  return 0;
}

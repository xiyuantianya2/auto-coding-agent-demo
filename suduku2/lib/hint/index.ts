/**
 * **高亮式提示引擎**（`hint-system`）公开入口。
 *
 * 基于当前盘面与 {@link import("@/lib/solver").findApplicableSteps `findApplicableSteps`} 等求解输出，
 * 向 UI 返回可高亮展示的下一步推理（相关格、候选强调与删减方向）；**不自动填入答案**。
 *
 * ## 步序选择（「下一步」是哪一条）
 *
 * `getNextHint` 内部调用 `findApplicableSteps(state)`，对其返回数组 **默认取首个元素**
 *（与 `find-applicable-steps` 文档一致：输出已按低→高阶批次与去重规则排序）。
 * 这样 UI 与测试对同一盘面得到稳定、可复现的一条提示；本模块不追求全局最优或最少分支。
 *
 * ## `messageKey` 与 solver 的 `explanationKey`
 *
 * {@link HintResult.messageKey `messageKey`} 与 {@link import("@/lib/solver").SolveStep `SolveStep.explanationKey`}
 * **同源对应**：映射阶段将求解步骤上的 `explanationKey` 原样写入提示的 `messageKey`，供 curriculum / i18n 使用；
 * 仅在求解步骤未提供说明键时省略。
 *
 * ## 提示次数与冷却（引擎无状态）
 *
 * 本模块**不维护**每局提示次数、冷却、节流或任何会话计数；这些由 UI 或上层可选实现。
 * 引擎侧对 `getNextHint` 的调用次数与频率**不设限**。
 *
 * ## 技巧标识符
 *
 * {@link TechniqueId} 与 {@link TechniqueIds} 与 `@/lib/solver` 及教学大纲共用同一套字符串 id，
 * 本模块不定义第二套平行命名。
 *
 * ## 类型再导出（与契约入口一致）
 *
 * 自本文件再导出 {@link GameState}、{@link SolveStep}、{@link TechniqueId}，便于消费者只从 `@/lib/hint`
 * 拉齐提示 API 与核心/求解类型，而无需混用深路径；实现仍仅从 `@/lib/core` / `@/lib/solver` 引用。
 *
 * @module @/lib/hint
 */

import { isVictory, type GameState } from "@/lib/core";
import { findApplicableSteps, type TechniqueId } from "@/lib/solver";

import { mapSolveStepToHintResult } from "./map-solve-step-to-hint-result";

// --- 与 `@/lib/core`、`@/lib/solver` 契约入口对齐的类型（便于 `@/lib/hint` 单点引用） ---
export type { GameState } from "@/lib/core";
export type { SolveStep, TechniqueId } from "@/lib/solver";
export { TechniqueIds } from "@/lib/solver";

export {
  extractHighlightCandidateRefs,
  mapHighlightsToCells,
  normalizeSolveStepHighlights,
  type HighlightCandidateCoord,
  type HighlightCellCoord,
} from "./map-highlights";

export {
  mergeCandidateHighlightsWithEliminations,
  parseEliminationEntries,
  type MergedHighlightCandidateEntry,
} from "./merge-highlight-candidates";

export { mapSolveStepToHintResult };

/**
 * 单条提示的高亮与说明载荷，与 `module-plan.json` 中 `hint-system` 契约一致。
 *
 * - **`technique`**：技巧 id，语义同 {@link import("@/lib/solver").SolveStep `SolveStep.technique`}，
 *   取值应与 {@link TechniqueIds} 中登记 id 或扩展字符串一致。
 * - **`cells`**：需要在棋盘上高亮的相关格坐标（行/列 0–8）。
 * - **`highlightCandidates`**：可选；按格列出需要强调的候选数字；`digits` 为展示高亮集合；
 *   `eliminate` 若存在，表示建议从该格**删去**的候选方向（与 solver 的删减语义一致）。
 * - **`messageKey`**：可选；面向 curriculum / i18n 的文案键，**对应**求解步骤上的
 *   {@link import("@/lib/solver").SolveStep `SolveStep.explanationKey`}（同源字段，提示侧命名）。
 */
export type HintResult = {
  technique: TechniqueId;
  cells: Array<{ r: number; c: number }>;
  highlightCandidates?: Array<{
    r: number;
    c: number;
    digits: number[];
    eliminate?: number[];
  }>;
  messageKey?: string;
};

/**
 * 返回当前盘面下「下一步」可展示的一条提示。
 *
 * 内部调用 {@link import("@/lib/solver").findApplicableSteps `findApplicableSteps(state)`}。
 * 该函数返回的数组已按 `find-applicable-steps` 文档约定：低→中→高阶批次合并、去重后的顺序；
 * **默认取首个元素**作为「下一步」提示，以便 UI 与测试快照稳定（不要求全局最优或最少分支）。
 *
 * - 若数组为空（含求解器在墙上时钟预算内未发现可应用步骤），返回 `null`。
 * - 若盘面已达胜利态（全盘填满且无冲突），返回 `null`，避免对终盘再调用求解搜索。
 *
 * 本函数**不修改** `state`、不维护提示次数；单次耗时主要由 `findApplicableSteps` 决定。
 *
 * @param state 当前游戏状态
 * @returns 提示载荷，或无可展示步骤时 `null`
 */
export function getNextHint(state: GameState): HintResult | null {
  if (isVictory(state)) {
    return null;
  }

  const steps = findApplicableSteps(state);
  if (steps.length === 0) {
    return null;
  }

  return mapSolveStepToHintResult(steps[0]!);
}

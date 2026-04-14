/**
 * **高亮式提示引擎**（`hint-system`）公开入口。
 *
 * 基于当前盘面与 {@link import("@/lib/solver").findApplicableSteps `findApplicableSteps`} 等求解输出，
 * 向 UI 返回可高亮展示的下一步推理（相关格、候选强调与删减方向）；**不自动填入答案**。
 *
 * ## 状态与次数
 *
 * 本模块**不维护**每局提示次数、冷却、节流或任何会话计数；这些由 UI 或上层可选实现。
 * 引擎侧对提示调用**无限制**。
 *
 * ## 技巧标识符
 *
 * {@link TechniqueId} 与 {@link TechniqueIds} 与 `@/lib/solver` 及教学大纲共用同一套字符串 id，
 * 本模块不定义第二套平行命名。
 *
 * @module @/lib/hint
 */

import type { GameState } from "@/lib/core";
import type { TechniqueId } from "@/lib/solver";

// --- 与 `@/lib/solver` 对齐的技巧 id（不重复定义平行常量表） ---
export type { TechniqueId };
export { TechniqueIds } from "@/lib/solver";

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
 * 返回当前盘面下「下一步」可展示的一条提示；尚未实现具体映射时占位返回 `null`。
 *
 * @param state 当前游戏状态（占位实现不读取盘面，也不会修改引用）
 * @returns 提示载荷，或暂无可展示步骤时 `null`
 */
export function getNextHint(state: GameState): HintResult | null {
  void state;
  return null;
}

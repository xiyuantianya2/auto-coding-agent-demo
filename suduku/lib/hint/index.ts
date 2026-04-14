/**
 * @packageDocumentation
 * 「提示引擎（仅高亮）」模块的公共入口（路径以 `tsconfig` 的 `@/*` 为准，例如 `@/lib/hint`）。
 *
 * **职责边界：** 只读分析当前盘面，向 UI 输出高亮区域与候选数字；**不**自动填数、**不**把消除写回盘面。
 *
 * **与 `module-plan.json` 中 hint-system 的 `interface` 一致：**
 *
 * `type HintResult = { cells: Array<{ r: number; c: number }>; highlightCandidates?: Array<{ r: number; c: number; digits: number[] }>; technique: TechniqueId; messageKey?: string }; function getNextHint(state: GameState): HintResult | null;`
 *
 * `TechniqueId` 与 `lib/solver` 中 `TECHNIQUE_IDS` 常量所用技巧标识为同一命名空间，本模块复用该类型而非重新定义。
 */

import type { GameState } from "@/lib/core";
import type { TechniqueId } from "@/lib/solver";

export type HintResult = {
  /** 需要在棋盘上高亮的格子坐标（行/列，0–8）。 */
  cells: Array<{ r: number; c: number }>;
  /** 可选：在指定格子上额外高亮的候选数字（去重后的升序列表由后续映射保证）。 */
  highlightCandidates?: Array<{ r: number; c: number; digits: number[] }>;
  /** 本步提示所依据的技巧标识（与求解引擎一致）。 */
  technique: TechniqueId;
  /** 可选：供文案层查找说明的稳定 key。 */
  messageKey?: string;
};

/**
 * 计算「下一步」教学提示对应的高亮数据；当前为骨架实现，恒返回 `null`。
 */
export function getNextHint(state: GameState): HintResult | null {
  void state;
  return null;
}

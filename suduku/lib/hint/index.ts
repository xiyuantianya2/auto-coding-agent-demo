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
import { getNextHintImpl } from "./get-next-hint";
import type { HintResult } from "./types";

/** 与 {@link HintResult.technique} 及 `lib/solver` 的 `TECHNIQUE_IDS` 共用同一命名空间；从本入口一并导出以便应用层只依赖 `@/lib/hint`。 */
export type { TechniqueId } from "@/lib/solver";

export {
  solveStepHighlightsToHintFields,
  type HintHighlightFields,
} from "./solve-step-highlights";

export { selectNextSolveStep } from "./select-next-solve-step";

export {
  HINT_MESSAGE_KEYS,
  HINT_TECHNIQUE_MESSAGE_KEY_PREFIX,
  getHintMessageKey,
  hintMessageKeyToTechniqueId,
} from "./message-keys";

export type { HintResult } from "./types";

/**
 * 计算「下一步」教学提示对应的高亮数据：串联求解引擎、选步与几何映射；只读、不填数。
 */
export function getNextHint(state: GameState): HintResult | null {
  return getNextHintImpl(state);
}

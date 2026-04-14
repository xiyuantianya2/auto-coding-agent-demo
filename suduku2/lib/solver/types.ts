import type { TechniqueId } from "./technique-ids";

/** 高亮目标类别（可序列化；`ref` 形状由调用方约定）。 */
export type HighlightKind = "cell" | "unit" | "candidate";

/**
 * 单步可解释推理（可序列化结构）。
 * `ref` 建议使用 `{ r: number; c: number }`、行/列/宫描述对象等稳定 JSON 友好形状。
 */
export type SolveStep = {
  technique: TechniqueId;
  highlights: Array<{ kind: HighlightKind; ref: unknown }>;
  eliminations?: unknown[];
  explanationKey?: string;
};

/**
 * 与 9×9 盘面一一对应的候选格。
 *
 * - **空格**（生效数字为 `0`）：`Set<number>`，元素为 `1`–`9` 中当前与同行/列/宫已出现数字不冲突的候选。
 *   若规则上无任何可填数字（矛盾盘面），为空集 `new Set()`。
 * - **已填格**（`given` 或 `value` 生效为 `1`–`9`）：为 `null`，表示「无铅笔候选语义」；
 *   确定数字请读 {@link import("@/lib/core").GameState.grid `grid`} / {@link import("@/lib/core").getEffectiveDigitAt `getEffectiveDigitAt`}。
 *
 * `CellState.notes` **不参与**本类型计算；`computeCandidates` 仅反映纯粹宫行列排除，玩家笔记同步由 `notes-logic` 负责。
 */
export type CandidatesCell = Set<number> | null;

/** 行优先：`candidates[r][c]`。 */
export type CandidatesGrid = CandidatesCell[][];

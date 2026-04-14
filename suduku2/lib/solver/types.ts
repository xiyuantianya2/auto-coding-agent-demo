import type { TechniqueId } from "./technique-ids";

/** 高亮目标类别（可序列化）。 */
export type HighlightKind = "cell" | "unit" | "candidate";

/**
 * 单步可解释推理（可序列化结构），与 `module-plan.json` 中 `solver-engine` 契约一致。
 *
 * ### `highlights[].ref`（`unknown`）推荐形状
 *
 * 下游 `hint-system`、`puzzle-generator` 等应只依赖这些 JSON 友好结构，避免耦合实现细节：
 *
 * - **`kind: "cell"`** → `{ r: number; c: number }`（0–8 行/列下标）
 * - **`kind: "unit"`** → `{ type: "row" | "col" | "box"; index: number }`（`index` 为 0–8）
 * - **`kind: "candidate"`** → `{ r: number; c: number; digit: number }`（标出涉及的候选数字）
 *
 * ### `eliminations`（可选）
 *
 * 仅「删候选」类技巧填写；每项建议为 `{ r: number; c: number; digit: number }`，表示在**当前**
 * {@link CandidatesGrid} 下应从 `(r,c)` 移除候选 `digit`。填数类步骤（如裸单）通常省略该字段。
 *
 * ### `explanationKey`
 *
 * 可选 i18n 文案键；与 {@link TechniqueId} 及教学大纲并列使用。
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

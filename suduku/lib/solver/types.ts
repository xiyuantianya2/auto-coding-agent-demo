/**
 * 技巧标识符：与教学大纲、提示系统共用同一字符串命名空间（见 `techniques.ts` 中 `TECHNIQUE_IDS`）。
 * 与仓库根 `module-plan.json` 中 solver-engine 的对外 `interface` 一致。
 */
export type TechniqueId = string;

/**
 * 候选网格：与 `GameState.cells` **相同的 9×9 行优先索引**（`r`,`c` ∈ 0…8）。
 * `candidates[r][c]` 为该格当前仍可用的候选数字集合（通常为 1–9 的子集）。
 * 已解格（`given` / `value`）对应**空集**（无待选数字）；空格为当前规则下仍可放置的数字集合。
 */
export type CandidatesGrid = Set<number>[][];

/** 高亮：盘面格子（与 UI `data-testid` / 矩阵下标一致）。 */
export type HighlightCellRef = { r: number; c: number };

/**
 * 高亮：单位（行 / 列 / 宫）。
 * - `row`：`index` 为行号 0…8。
 * - `col`：`index` 为列号 0…8。
 * - `box`：`index` 为宫号 0…8，**行优先**遍历 9 个 3×3 宫（与 `lib/core` 的 `boxIndexFromCell` 语义一致）。
 */
export type HighlightUnitRef = {
  unit: "row" | "col" | "box";
  index: number;
};

/**
 * 高亮：绑定「格子 + 候选数字」，用于标出关键笔记或将被消除的候选。
 * `digit` 为 1–9。
 */
export type HighlightCandidateRef = {
  r: number;
  c: number;
  digit: number;
};

/**
 * 单步技巧解释的 UI / 提示高亮条目。
 *
 * - `kind: 'cell'` → `ref` 为 {@link HighlightCellRef}
 * - `kind: 'unit'` → `ref` 为 {@link HighlightUnitRef}
 * - `kind: 'candidate'` → `ref` 为 {@link HighlightCandidateRef}
 *
 * 与 `module-plan` 中的 `ref: unknown` 兼容：此处为**可辨识联合**，便于 hint-system 与难度模块消费。
 */
export type SolveStepHighlight =
  | { kind: "cell"; ref: HighlightCellRef }
  | { kind: "unit"; ref: HighlightUnitRef }
  | { kind: "candidate"; ref: HighlightCandidateRef };

/**
 * 从某格的笔记中移除的候选（用于可解释消除步骤，与 hint 模块 `highlightCandidates` 可对照）。
 */
export type CandidateElimination = {
  r: number;
  c: number;
  digits: number[];
};

/**
 * 一步可观察的技巧实例：技法 id、用于渲染的高亮、可选的候选消除列表。
 * （`module-plan`：`eliminations?: unknown[]` — 此处推荐使用 {@link CandidateElimination}[]。）
 */
export type SolveStep = {
  technique: TechniqueId;
  highlights: SolveStepHighlight[];
  eliminations?: CandidateElimination[];
};

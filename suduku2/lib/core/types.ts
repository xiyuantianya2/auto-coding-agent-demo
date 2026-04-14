/**
 * 9×9 盘面，行优先：`grid[r][c]`。
 *
 * - **`0`**：该格当前无确定数字（空格）。
 * - **`1`–`9`**：该格当前生效的确定数字。
 *
 * 与 {@link CellState} 的同步约定见 {@link GameState}。
 */
export type Grid9 = number[][];

/**
 * 单个单元格的纯数据状态（逻辑层）。
 *
 * - **`given`**：题目给定提示数（1–9）。存在时表示题面锁定格；规则层默认禁止玩家清除或改填（除非产品另行约定）。
 * - **`value`**：玩家填入的解答（1–9）。未填时不写该字段或视为未定义。若与 `given` 同时存在，**显示与规则校验以 `given` 为准**；`value` 可留作冗余或回放用途，由上层统一策略。
 * - **`notes`**：铅笔候选集合，元素为 1–9 的子集。与「当前确定数字」互斥的语义由 `mode` 与后续规则任务定义；通常有 `given` 或有效 `value` 时不再显示笔记。
 */
export interface CellState {
  given?: number;
  value?: number;
  notes?: Set<number>;
}

/**
 * 主输入模式：填入确定数字 / 编辑铅笔笔记。
 * 与 `module-plan.json` 中 `GameState.mode: 'fill'|'notes'` 一致。
 */
export type FillNotesMode = "fill" | "notes";

/**
 * 一局游戏的快照：`grid` 与 `cells` 并行维护，服务快速规则扫描与 UI/存档。
 *
 * ## `grid` 与 `cells` 的同步关系
 *
 * 对任意坐标 `(r,c)`，记 `g = cells[r][c].given`，`v = cells[r][c].value`。
 *
 * - **生效数字**（用于同行/列/宫冲突判断、胜负「是否填满」）：`effective = g ?? v ?? EMPTY_CELL`（`EMPTY_CELL` 为 `0`）。
 * - **不变式（由调用方与后续规则任务维护）**：`grid[r][c] === effective`，且 `grid[r][c]` 必为 `0` 或 `1`–`9`。
 * - **给定数**：若 `given` 存在，则 `grid[r][c] === given`，且玩家不应把该格改为其他数字（除非产品允许改题面）。
 * - **空格**：`effective === 0` 时该格为空；`notes` 可非空（笔记模式下）。
 *
 * `mode` 仅描述 UI/输入状态机，不参与数独规则本身；存档应保留以便恢复界面。
 */
export interface GameState {
  grid: Grid9;
  cells: CellState[][];
  /** UI 输入模式；与规则判定独立，存档应保留。 */
  mode: FillNotesMode;
}

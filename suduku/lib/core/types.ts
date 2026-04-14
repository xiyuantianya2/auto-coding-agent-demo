/**
 * 9×9 盘面，行优先索引。`0` 表示空位，`1`–`9` 为数字。
 * 常用于题目 givens、生成器输出或与 {@link CellState} 并存的纯数字视图。
 */
export type Grid9 = number[][];

/**
 * 单个单元格的纯数据状态（逻辑层）。
 *
 * - **`given`**：题目提示数（1–9）。存在时表示该格为题面锁定格，后续规则层应禁止玩家清除或改填（除非产品明确允许「擦除题目」，本模块默认不可改）。
 * - **`value`**：玩家填入的解答（1–9）。空表示未填。与 `given` 同时存在时，显示与校验应以 `given` 为准（`value` 可视为冗余或用于回放，具体由后续任务统一）。
 * - **`notes`**：铅笔候选集合，元素为 1–9 的子集。填数模式下通常与「当前显示数字」互斥：有确定填数时应清空笔记；仅笔记模式下可无 `given`/`value` 仅有 `notes`。
 */
export interface CellState {
  given?: number;
  value?: number;
  notes?: Set<number>;
}

/** 棋盘输入：填数字或记笔记。 */
export type InputMode = "value" | "notes";

/** 与 `module-plan` 中无尽难度档一致。 */
export type DifficultyTier = "easy" | "normal" | "hard" | "hell";

/**
 * 高层游戏模式（纯数据，供存档 / UI / server 路由）。
 * `solver-engine` 仅依赖其中的盘面 {@link GameState.cells}，此处为扩展预留。
 */
export type GameMode =
  | { kind: "free" }
  | { kind: "endless"; tier: DifficultyTier; levelIndex: number }
  | { kind: "practice"; techniqueId: string }
  | { kind: "tutorial"; chapterId: string };

/**
 * 一局游戏的完整快照：盘面 + 输入与计时等元数据。
 * `cells` 为 9×9，与 {@link BOARD_SIZE} 一致；行 `r`、列 `c` 为 0 起始。
 */
export interface GameState {
  /** 与序列化格式一致，用于向后兼容演进。 */
  schemaVersion: number;
  /** 9×9；类型上长度由调用方保证，规则函数将校验索引与尺寸。 */
  cells: CellState[][];
  /** 当前主输入模式（填数 / 笔记）。 */
  inputMode: InputMode;
  /** 是否暂停（仅标志；累计时间在 `elapsedMs`）。 */
  paused: boolean;
  /** 已累计的游玩毫秒（暂停策略由 UI 层解释）。 */
  elapsedMs: number;
  /** 当前模式（无尽 / 专项 / 教学等）。 */
  mode: GameMode;
  /** 题目或存档标识（可选）。 */
  puzzleId?: string;
  /** 当前选中格（可选，供 UI 与提示高亮）。 */
  selection?: { r: number; c: number } | null;
}

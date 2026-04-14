/**
 * 「笔记与撤销逻辑」模块的类型契约（与 `module-plan.json` 中 `notes-logic` 对齐；
 * `NotesCommand` 在各分支使用显式 `payload`，而非裸 `unknown`）。
 */

/** 切换某一格的单枚铅笔数字时的坐标与数字（digit ∈ 1…9）。 */
export type ToggleNotesPayload = {
  r: number;
  c: number;
  digit: number;
};

/** 清空指定格的笔记（不改变 given / value）。 */
export type ClearCellNotesPayload = {
  r: number;
  c: number;
};

/**
 * 批量清除若干格的笔记（仅清除笔记，不改 given/value）。
 * 顺序由调用方数组顺序决定；实现层须保持确定顺序（见后续任务说明）。
 */
export type BatchClearNotesPayload = {
  cells: Array<{ r: number; c: number }>;
};

/** `applyNotesCommand` 中 `undo` 分支的占位 payload（推荐撤销走 {@link createUndoStack}）。 */
export type UndoNotesPayload = Record<string, never>;

/**
 * 在「填数模式」与「笔记模式」之间切换（具体是否写入 `GameState` 由后续任务与 core 约定）。
 * - `fill`：主输入为填入数字；
 * - `notes`：主输入为铅笔标记。
 */
export type SetNotesModePayload = {
  mode: "fill" | "notes";
};

/**
 * 发往笔记模块的命令：判别联合，`payload` 随 `type` 收窄。
 *
 * 与 module-plan 原文 `payload: unknown` 兼容：本包将其细化为下列分支之一。
 */
export type NotesCommand =
  | { type: "toggle"; payload: ToggleNotesPayload }
  | { type: "clearCell"; payload: ClearCellNotesPayload }
  | { type: "batchClear"; payload: BatchClearNotesPayload }
  | { type: "undo"; payload: UndoNotesPayload }
  | { type: "setMode"; payload: SetNotesModePayload };

/**
 * 行 / 列 / 宫 / 数字 的一键筛选高亮键（纯数据，不含 UI）。
 *
 * - `row` / `col` / `box`：`index` ∈ 0…8（宫编号与 `lib/core` 的 `boxIndexFromCell` 行优先语义一致）。
 * - `digit`：**固定语义** — `index` ∈ 0…8 表示盘面数字 **digit = index + 1**（即 1…9 映射到 index 0…8）。
 */
export type HighlightFilter =
  | { type: "row"; index: number }
  | { type: "col"; index: number }
  | { type: "box"; index: number }
  | { type: "digit"; index: number };

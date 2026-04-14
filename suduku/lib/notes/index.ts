/**
 * @packageDocumentation
 * 「笔记与撤销逻辑」模块的公共入口（路径以 `tsconfig` 的 `@/*` 为准，例如 `@/lib/notes`）。
 *
 * **职责边界：** 只处理铅笔标记的切换/清除、与 {@link CandidatesGrid} 的同步、撤销栈与
 * {@link HighlightFilter} 等**数据结构**；**不**实现 React / 页面 UI，**不**直接读写路由或持久化。
 *
 * **与 `module-plan.json` 中 notes-logic 的对外契约一致：**
 *
 * - 类型名：`NotesCommand`、`HighlightFilter`（本包将 `NotesCommand.payload` 细化为可辨识联合，见 `./types`）。
 * - 函数：`applyNotesCommand`、`syncNotesWithCandidates`、`createUndoStack`（签名见下方导出）。
 *
 * `syncNotesWithCandidates` 已实现：按候选收紧笔记、清理已解格笔记。
 * `getHighlightCells` / `cellsForRow|Col|Box`：一键筛选高亮坐标（见 `./highlight-filter`）。
 * `applyNotesCommand` 已实现 `toggle` / `clearCell` / `setMode` / `batchClear`。
 * **`undo` 命令：** 不要传入 `{ type: 'undo' }`（会抛错）。在变更前对当前盘面 `createUndoStack().push(state)`，撤销时调用同一栈的 `undo()`（见 {@link createUndoStack} 注释）。
 */

import type { GameState } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

import type { NotesCommand } from "./types";
import { applyNotesCommandImpl } from "./apply-notes-command";
import { syncNotesWithCandidates as syncNotesWithCandidatesImpl } from "./sync-notes";

export type {
  HighlightCellCoord,
  NotesHighlightCells,
} from "./highlight-filter";
export { cellsForBox, cellsForCol, cellsForRow, getHighlightCells } from "./highlight-filter";

export type {
  BatchClearNotesPayload,
  ClearCellNotesPayload,
  HighlightFilter,
  NotesCommand,
  SetNotesModePayload,
  ToggleNotesPayload,
  UndoNotesPayload,
} from "./types";

export { createUndoStack } from "./undo-stack";

/**
 * 将一条笔记命令应用到盘面（不可变更新）。已实现 `toggle` / `clearCell` / `setMode` / `batchClear`（见 `./apply-notes-command`）。
 */
export function applyNotesCommand(
  state: GameState,
  cmd: NotesCommand,
  candidates: CandidatesGrid,
): GameState {
  return applyNotesCommandImpl(state, cmd, candidates);
}

/** 按当前候选网格剔除不再合法的铅笔数、并清理已解格笔记（与 `computeCandidates` 输出对齐）。 */
export function syncNotesWithCandidates(
  state: GameState,
  candidates: CandidatesGrid,
): GameState {
  return syncNotesWithCandidatesImpl(state, candidates);
}

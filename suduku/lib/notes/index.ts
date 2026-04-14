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
 * `applyNotesCommand` 仍为骨架；`createUndoStack` 的 `undo` 在未 `push` 时返回 `null`（占位行为，完整逻辑见后续任务）。
 */

import type { GameState } from "@/lib/core";
import { cloneGameState } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

import type { NotesCommand } from "./types";
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

/**
 * 将一条笔记命令应用到盘面（不可变更新）。骨架阶段：忽略 `cmd` 与 `candidates`，返回克隆状态。
 */
export function applyNotesCommand(
  state: GameState,
  cmd: NotesCommand,
  candidates: CandidatesGrid,
): GameState {
  void cmd;
  void candidates;
  return cloneGameState(state);
}

/** 按当前候选网格剔除不再合法的铅笔数、并清理已解格笔记（与 `computeCandidates` 输出对齐）。 */
export function syncNotesWithCandidates(
  state: GameState,
  candidates: CandidatesGrid,
): GameState {
  return syncNotesWithCandidatesImpl(state, candidates);
}

/**
 * 创建基于 `GameState` 深快照的撤销栈。骨架阶段：`push` 为 no-op，`undo` 恒返回 `null`。
 */
export function createUndoStack(): {
  push(s: GameState): void;
  undo(): GameState | null;
} {
  return {
    push() {
      /* 占位：后续任务使用 cloneGameState 入栈 */
    },
    undo() {
      return null;
    },
  };
}

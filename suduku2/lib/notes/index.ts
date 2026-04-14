/**
 * **笔记、同步剔除与撤销栈**（`notes-logic`）公开入口。
 *
 * 下游应自本文件引用（例如 `import { … } from "@/lib/notes"`），避免深路径耦合。
 *
 * ## 依赖
 *
 * - 盘面与规则类型来自 {@link import("@/lib/core").GameState `@/lib/core`}（如 {@link import("@/lib/core").cloneGameState `cloneGameState`}）。
 * - 候选网格形状 **仅** 使用 {@link import("@/lib/solver").CandidatesGrid `CandidatesGrid`}（自 `@/lib/solver` 导入），本模块不重复定义候选网格类型。
 *
 * ## 与提示步协作（摘要）
 *
 * 本模块不拦截 `@/lib/hint` 的 `getNextHint`。若外部推理或提示会改变 `GameState`，调用方应在应用前后使用 {@link UndoRedoApi.push} 维护可撤销快照；完整约定将在后续任务中补充。
 *
 * @module @/lib/notes
 */

import type { GameState } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

/**
 * 统一笔记与输入模式的命令；`payload` 在运行时为 `unknown`，由 {@link applyCommand} 按 `type` 做窄化。
 *
 * ### 各 `type` 的**推荐** `payload` 形状
 *
 * - **`toggle`**：`{ r: number; c: number; digit: number }` — 笔记模式下在 `(r,c)` 切换铅笔标记 `digit`（`1`–`9`）。
 * - **`clearCell`**：`{ r: number; c: number }` — 清除非给定格的玩家填数，并按规则清理相关笔记。
 * - **`fill`**：`{ r: number; c: number; digit: number }` — 填数模式下在 `(r,c)` 填入 `digit`，并与 {@link syncNotesAfterValue} 串联做同行/列/宫笔记剔除。
 * - **`setMode`**：`{ mode: import("@/lib/core").FillNotesMode }` — 即 `{ mode: 'fill' | 'notes' }`，切换当前输入模式。
 * - **`undo`** / **`redo`**：**后续任务**与 {@link UndoRedoApi} 集成 — 推荐将 `UndoRedoApi` 实例置于 `payload`（或对 `unknown` 校验后使用），由 {@link applyCommand} 调用 {@link UndoRedoApi.undo} / {@link UndoRedoApi.redo}，并以返回的 `GameState` 作为结果；若返回 `null`，语义由实现与 JSDoc 固定。**本任务不实现**具体分支逻辑，仅占位。
 */
export type NotesCommand = {
  type: "toggle" | "clearCell" | "fill" | "undo" | "redo" | "setMode";
  payload: unknown;
};

/**
 * 撤销/重做栈 API；快照须与 `@/lib/core` 的 {@link import("@/lib/core").cloneGameState `cloneGameState`} 深拷贝语义一致（见后续任务实现说明）。
 */
export type UndoRedoApi = {
  push(snapshot: GameState): void;
  undo(): GameState | null;
  redo(): GameState | null;
  canUndo(): boolean;
  canRedo(): boolean;
};

/**
 * 应用一条 {@link NotesCommand}；`candidates` 通常由 `@/lib/solver` 的 `computeCandidates` 提供。
 *
 * @throws {Error} 本任务为骨架阶段，始终抛出 `'not implemented'`。
 */
export function applyCommand(
  state: GameState,
  cmd: NotesCommand,
  candidates: CandidatesGrid,
): GameState {
  void state;
  void cmd;
  void candidates;
  throw new Error("not implemented");
}

/**
 * 在已更新的填数前提下，将铅笔笔记与规则同步（同行/列/宫剔除等）。
 *
 * @throws {Error} 本任务为骨架阶段，始终抛出 `'not implemented'`。
 */
export function syncNotesAfterValue(
  state: GameState,
  candidates: CandidatesGrid,
): GameState {
  void state;
  void candidates;
  throw new Error("not implemented");
}

/**
 * 创建撤销/重做栈实例。
 *
 * @returns 占位实现：栈空、`undo`/`redo` 返回 `null`；后续任务将改为基于 `cloneGameState` 的完整语义。
 */
export function createUndoRedo(): UndoRedoApi {
  return {
    push() {},
    undo() {
      return null;
    },
    redo() {
      return null;
    },
    canUndo() {
      return false;
    },
    canRedo() {
      return false;
    },
  };
}

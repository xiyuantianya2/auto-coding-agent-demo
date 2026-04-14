import type { GameState } from "@/lib/core";
import { cloneGameState } from "@/lib/core";

/**
 * 创建基于 `GameState` 深快照的撤销栈。
 *
 * **集成约定（避免与 `applyNotesCommand` 的 `undo` 命令双重语义）：**
 * - 在任意会改变笔记或可编辑单元格内容的操作**之前**，调用方应对**当前**盘面调用 `push(state)`；
 *   `push` 会用 {@link cloneGameState} 入栈，与入参对象脱钩。
 * - 撤销时只使用本对象的 `undo()`：弹出并返回最近一次 `push` 的快照；栈空时返回 `null`。
 * - **不要**向 {@link applyNotesCommand} 传入 `{ type: 'undo' }`（该分支会抛错）；撤销仅通过本栈完成。
 */
export function createUndoStack(): {
  push(s: GameState): void;
  undo(): GameState | null;
} {
  const stack: GameState[] = [];
  return {
    push(s: GameState) {
      stack.push(cloneGameState(s));
    },
    undo() {
      if (stack.length === 0) {
        return null;
      }
      return stack.pop()!;
    },
  };
}

/**
 * **笔记、同步剔除与撤销栈**（`notes-logic`）公开入口。
 *
 * 下游应自本文件引用（例如 `import { … } from "@/lib/notes"`），避免深路径耦合。
 *
 * ## 公开 API
 *
 * 本模块导出：{@link NotesCommand}、{@link applyCommand}、{@link syncNotesAfterValue}、{@link applyFullBoardPencilNotes}、{@link createUndoRedo}、{@link UndoRedoApi}。
 *
 * ## 依赖
 *
 * - 盘面与规则类型来自 {@link import("@/lib/core").GameState `@/lib/core`}（如 {@link import("@/lib/core").cloneGameState `cloneGameState`}）。
 * - 候选网格形状 **仅** 使用 {@link import("@/lib/solver").CandidatesGrid `CandidatesGrid`}（自 `@/lib/solver` 导入），本模块不重复定义候选网格类型。
 *
 * ## 与 `@/lib/hint` 及任意「外部步」的撤销协作
 *
 * 本模块 **不会** 自动调用或拦截 {@link import("@/lib/hint").getNextHint `getNextHint`}；笔记命令与撤销栈只响应你显式传入的 {@link NotesCommand} 与 {@link UndoRedoApi}。
 *
 * 当调用方在应用提示推理、自动解题步、或任何会改写 {@link import("@/lib/core").GameState `GameState`} 的逻辑 **之前** 希望保留可撤销点，应：
 *
 * 1. 对**当前**盘面调用 {@link UndoRedoApi.push}`(state)`（或等价地 `push(cloneGameState(state))`，视你的快照策略而定；栈内会再 `clone` 一次以防别名）。
 * 2. 执行外部变更（例如根据 `getNextHint` 的结果高亮后，由 UI 填入数字并再调 {@link applyCommand} / 或直接改 `GameState`）。
 * 3. 若用户撤销该步，用 {@link NotesCommand} `undo` 分支传入同一 {@link UndoRedoApi}，或自行 `undo()` 取回快照后再把结果交回 UI。
 *
 * `getNextHint` 本身按契约 **不修改** 传入的 `GameState`；但若你在「看过提示之后」用其它代码改了盘面，撤销责任仍在调用方。若一次操作链中混合了本模块命令与外部改写，请在**每一段可撤销操作前** `push`，以保证栈与玩家预期一致。
 *
 * @module @/lib/notes
 */

import {
  BOX_HEIGHT,
  BOX_WIDTH,
  cloneGameState,
  getEffectiveDigitAt,
  isFilledDigit,
  isLegalClearCell,
  isLegalFill,
  isLegalToggleNote,
  type GameState,
} from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

export { applyFullBoardPencilNotes } from "./fill-all-pencil-notes";

/**
 * 统一笔记与输入模式的命令；`payload` 在运行时为 `unknown`，由 {@link applyCommand} 按 `type` 做窄化。
 *
 * ### 各 `type` 的**推荐** `payload` 形状
 *
 * - **`toggle`**：`{ r: number; c: number; digit: number }` — 笔记模式下在 `(r,c)` 切换铅笔标记 `digit`（`1`–`9`）。
 * - **`clearCell`**：`{ r: number; c: number }` — 清除非给定格的玩家填数，并按规则清理相关笔记。
 * - **`fill`**：`{ r: number; c: number; digit: number }` — 填数模式下在 `(r,c)` 填入 `digit`，并与 {@link syncNotesAfterValue} 串联做同行/列/宫笔记剔除。
 * - **`setMode`**：`{ mode: import("@/lib/core").FillNotesMode }` — 即 `{ mode: 'fill' | 'notes' }`，切换当前输入模式。
 * - **`undo`** / **`redo`**：`payload` **应为** {@link UndoRedoApi} 实例（至少具备可调用的 `undo` / `redo` 方法）。{@link applyCommand} 会调用 `payload.undo()` 或 `payload.redo()` 并以返回的 `GameState` 作为结果；若返回 `null`（栈空等），则返回 {@link cloneGameState}`(state)` —— 与输入盘面快照等价的新克隆。`payload` 形状不符时同样返回输入状态的克隆（不抛错）。本路径**不**调用 `findApplicableSteps`。
 */
export type NotesCommand = {
  type: "toggle" | "clearCell" | "fill" | "undo" | "redo" | "setMode";
  payload: unknown;
};

/**
 * 撤销/重做栈 API。
 *
 * 实现为**线性历史 + 游标**：每次 {@link UndoRedoApi.push} 将传入盘面用
 * {@link import("@/lib/core").cloneGameState `cloneGameState`} 深拷贝后接到历史末尾，并丢弃当前游标之后的「重做分支」。
 * 存储与返回的 `GameState` 均不共享 `Set` 等可变引用，避免后续修改污染历史。
 *
 * 极端长会话下栈深会随 `push` 次数增长；本模块不对历史做压缩或「最小内存」优化，调用方可自行限制步数或定期清空实例。
 */
export type UndoRedoApi = {
  /**
   * 将当前盘面快照压入撤销历史：内部使用 `cloneGameState(snapshot)`，随后清空重做分支（与标准编辑器行为一致）。
   */
  push(snapshot: GameState): void;
  /**
   * 将游标移向上一快照并返回该状态；若已在最早快照（含尚无历史）则返回 `null`。
   * 返回值为新克隆，可安全修改而不影响栈内存储。
   */
  undo(): GameState | null;
  /**
   * 将游标移向下一快照并返回该状态；若无可用重做则返回 `null`。
   * 返回值为新克隆，可安全修改而不影响栈内存储。
   */
  redo(): GameState | null;
  /** 当且仅当 `undo()` 会返回非 `null` 时为 `true`。 */
  canUndo(): boolean;
  /** 当且仅当 `redo()` 会返回非 `null` 时为 `true`。 */
  canRedo(): boolean;
};

/**
 * 应用一条 {@link NotesCommand}；`candidates` 通常由 `@/lib/solver` 的 `computeCandidates` 提供。
 *
 * ### 非法命令与未实现分支
 *
 * - **`setMode` / `toggle` / `clearCell` / `fill`**：若 `payload` 形状不符推荐约定，或经 `@/lib/core` 规则判定为非法操作
 *   （例如 `notes` 模式下填数、违反 {@link import("@/lib/core").isLegalFill `isLegalFill`}），**不修改逻辑状态**，返回
 *   {@link cloneGameState}`(state)` 的**新克隆**（与输入盘面快照等价，不抛出异常）。
 * - **`undo` / `redo`**：`payload` 须为带 `undo()` / `redo()` 的对象（见 {@link NotesCommand}）。若方法返回 `GameState`，直接作为返回值；若返回 `null` 或 `payload` 非法，返回 {@link cloneGameState}`(state)`。`candidates` 参数被忽略。不调用 `findApplicableSteps`。
 *
 * ### `fill` 与 `candidates`（避免双份候选实现）
 *
 * 合法 `fill` 先在克隆上写入 `grid` / `cells`（与 `@/lib/core` 不变式一致），再对**更新后**的盘面调用
 * {@link syncNotesAfterValue}`(next, candidates)`。`candidates` 应由调用方用 `@/lib/solver` 的
 * {@link import("@/lib/solver").computeCandidates `computeCandidates`} 生成。推荐与典型 UI 一致：**在调用
 * `applyCommand` 之前**对**当前**（填数前）盘面执行一次 `computeCandidates` 并传入 —— 与上一帧用于渲染笔记/高亮的候选网格相同，避免在命令路径内重复计算。若希望与填数后盘面严格对齐（例如仅做交集修剪），可改为传入 `computeCandidates(填数后的中间状态)`，但需自行在 UI 层保持与显示一致。
 *
 * 合法分支均在内部 `clone` 上变更，**从不**就地修改入参 `state`。
 */
export function applyCommand(
  state: GameState,
  cmd: NotesCommand,
  candidates: CandidatesGrid,
): GameState {
  switch (cmd.type) {
    case "setMode": {
      const p = cmd.payload as { mode?: unknown };
      if (p?.mode !== "fill" && p?.mode !== "notes") {
        return cloneGameState(state);
      }
      const next = cloneGameState(state);
      next.mode = p.mode;
      return next;
    }
    case "toggle": {
      const p = cmd.payload as { r?: unknown; c?: unknown; digit?: unknown };
      if (
        typeof p.r !== "number" ||
        typeof p.c !== "number" ||
        typeof p.digit !== "number" ||
        !Number.isInteger(p.r) ||
        !Number.isInteger(p.c) ||
        !Number.isInteger(p.digit)
      ) {
        return cloneGameState(state);
      }
      const { r, c, digit } = p;
      if (!isLegalToggleNote(state, r, c, digit)) {
        return cloneGameState(state);
      }
      const next = cloneGameState(state);
      const cell = next.cells[r][c];
      const toggled = new Set(cell.notes ?? []);
      if (toggled.has(digit)) {
        toggled.delete(digit);
      } else {
        toggled.add(digit);
      }
      next.cells[r][c] = {
        ...cell,
        notes: toggled.size > 0 ? toggled : undefined,
      };
      next.grid[r][c] = getEffectiveDigitAt(next, r, c);
      return next;
    }
    case "clearCell": {
      const p = cmd.payload as { r?: unknown; c?: unknown };
      if (
        typeof p.r !== "number" ||
        typeof p.c !== "number" ||
        !Number.isInteger(p.r) ||
        !Number.isInteger(p.c)
      ) {
        return cloneGameState(state);
      }
      const { r, c } = p;
      if (!isLegalClearCell(state, r, c)) {
        return cloneGameState(state);
      }
      const next = cloneGameState(state);
      const cell = next.cells[r][c];
      const cleared: typeof cell = { ...cell };
      delete cleared.value;
      delete cleared.notes;
      next.cells[r][c] = cleared;
      next.grid[r][c] = getEffectiveDigitAt(next, r, c);
      return next;
    }
    case "fill": {
      const p = cmd.payload as { r?: unknown; c?: unknown; digit?: unknown };
      if (
        typeof p.r !== "number" ||
        typeof p.c !== "number" ||
        typeof p.digit !== "number" ||
        !Number.isInteger(p.r) ||
        !Number.isInteger(p.c) ||
        !Number.isInteger(p.digit)
      ) {
        return cloneGameState(state);
      }
      const { r, c, digit } = p;
      if (!isLegalFill(state, r, c, digit)) {
        return cloneGameState(state);
      }
      const next = cloneGameState(state);
      next.grid[r][c] = digit;
      const prev = next.cells[r][c];
      next.cells[r][c] = { given: prev.given, value: digit };
      return syncNotesAfterValue(next, candidates);
    }
    case "undo": {
      const p = cmd.payload;
      if (p === null || typeof p !== "object" || typeof (p as { undo?: unknown }).undo !== "function") {
        return cloneGameState(state);
      }
      const result = (p as UndoRedoApi).undo();
      return result ?? cloneGameState(state);
    }
    case "redo": {
      const p = cmd.payload;
      if (p === null || typeof p !== "object" || typeof (p as { redo?: unknown }).redo !== "function") {
        return cloneGameState(state);
      }
      const result = (p as UndoRedoApi).redo();
      return result ?? cloneGameState(state);
    }
  }
}

/**
 * 在已更新的填数前提下，将铅笔笔记与规则同步（同行/列/宫剔除等）。
 *
 * ### 行为
 *
 * 1. **深拷贝**：始终基于 {@link import("@/lib/core").cloneGameState `cloneGameState`} 返回新状态，不修改入参 `state`。
 * 2. **已填格**：对生效数字为 `1`–`9` 的格子清除 `notes`（与常见应用一致）。
 * 3. **同行 / 列 / 宫剔除**：对每个已填数字 `d`，在**其它仍为空的格子**中，若 `notes` 含 `d` 则移除。
 * 4. **与 `candidates` 求交（已实现）**：对仍为空的格子，若存在 `notes`，则与 `candidates[r][c]` 求交；
 *    `candidates` 为 `null`（已填语义）或缺失时跳过该格。这样可将玩家笔记修剪到与
 *    {@link import("@/lib/solver").computeCandidates `computeCandidates`} 在当前盘面下给出的**基础排除候选**一致，
 *    避免长期背离。本函数**不**调用 `computeCandidates` 或 `findApplicableSteps`，仅做集合与坐标遍历。
 *
 * @param candidates 通常由调用方对**当前**盘面执行 `computeCandidates` 得到；若未做交集修剪，可传入与 `state` 同形的占位网格（空格为 `Set` 或 `null`）。
 */
export function syncNotesAfterValue(
  state: GameState,
  candidates: CandidatesGrid,
): GameState {
  const next = cloneGameState(state);
  const cells = next.cells;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const d = getEffectiveDigitAt(next, r, c);
      if (!isFilledDigit(d)) {
        continue;
      }

      const filled = cells[r][c];
      if (filled.notes !== undefined) {
        delete filled.notes;
      }

      for (let cc = 0; cc < 9; cc++) {
        if (cc === c) {
          continue;
        }
        removeNoteDigitFromEmptyCell(next, r, cc, d);
      }

      for (let rr = 0; rr < 9; rr++) {
        if (rr === r) {
          continue;
        }
        removeNoteDigitFromEmptyCell(next, rr, c, d);
      }

      const br = Math.floor(r / BOX_HEIGHT) * BOX_HEIGHT;
      const bc = Math.floor(c / BOX_WIDTH) * BOX_WIDTH;
      for (let dr = 0; dr < BOX_HEIGHT; dr++) {
        for (let dc = 0; dc < BOX_WIDTH; dc++) {
          const rr = br + dr;
          const cc = bc + dc;
          if (rr === r && cc === c) {
            continue;
          }
          removeNoteDigitFromEmptyCell(next, rr, cc, d);
        }
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (isFilledDigit(getEffectiveDigitAt(next, r, c))) {
        continue;
      }

      const candCell = candidates[r][c];
      if (candCell === null) {
        continue;
      }

      const cell = cells[r][c];
      if (cell.notes === undefined || cell.notes.size === 0) {
        continue;
      }

      const trimmed = new Set<number>();
      for (const n of cell.notes) {
        if (candCell.has(n)) {
          trimmed.add(n);
        }
      }

      if (trimmed.size === 0) {
        delete cell.notes;
      } else if (trimmed.size !== cell.notes.size) {
        cell.notes = trimmed;
      }
    }
  }

  return next;
}

/** 仅从「当前视为空格」的格子中移除笔记数字；已填格不修改（剔除由对已填格遍历触发）。 */
function removeNoteDigitFromEmptyCell(
  state: GameState,
  r: number,
  c: number,
  digit: number,
): void {
  if (isFilledDigit(getEffectiveDigitAt(state, r, c))) {
    return;
  }
  const cell = state.cells[r][c];
  if (cell.notes === undefined || !cell.notes.has(digit)) {
    return;
  }
  const nextNotes = new Set(cell.notes);
  nextNotes.delete(digit);
  if (nextNotes.size === 0) {
    delete cell.notes;
  } else {
    cell.notes = nextNotes;
  }
}

/**
 * 创建撤销/重做栈实例（线性历史 + 游标；`push` / `undo` / `redo` 均为 O(1) 摊销栈操作加单次 `cloneGameState` 成本）。
 */
export function createUndoRedo(): UndoRedoApi {
  /** 深拷贝后的快照序列；下标 `0` 为最旧。 */
  const history: GameState[] = [];
  /** 指向当前历史位置；`-1` 表示尚未有任何 `push`。 */
  let cursor = -1;

  return {
    push(snapshot) {
      const next = history.slice(0, cursor + 1);
      history.length = 0;
      history.push(...next, cloneGameState(snapshot));
      cursor = history.length - 1;
    },
    undo() {
      if (cursor <= 0) {
        return null;
      }
      cursor -= 1;
      return cloneGameState(history[cursor]!);
    },
    redo() {
      if (cursor < 0 || cursor >= history.length - 1) {
        return null;
      }
      cursor += 1;
      return cloneGameState(history[cursor]!);
    },
    canUndo() {
      return cursor > 0;
    },
    canRedo() {
      return cursor >= 0 && cursor < history.length - 1;
    },
  };
}

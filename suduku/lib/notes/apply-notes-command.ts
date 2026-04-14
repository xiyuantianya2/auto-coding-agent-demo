/**
 * `applyNotesCommand` 的实现分支（toggle / clearCell / setMode / batchClear；`undo` 由撤销栈处理，见 `undo-stack.ts`）。
 *
 * **存档与 {@link GameState.inputMode}：** `inputMode` 为 core 模型上的可选字段；旧存档缺省该字段时与
 * `fill` 语义一致（见 `lib/core/types.ts` 注释）。序列化层在字段存在时写入 JSON，保证读回后行为一致。
 */

import type { GameState } from "@/lib/core";
import {
  canModifyCell,
  cloneGameState,
  findObviousConflictPositions,
  isLegalToggleNote,
} from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

import { cellIsSolved, syncNotesWithCandidates } from "./sync-notes";
import { cellsForBox, cellsForCol, cellsForRow } from "./highlight-filter";
import type { BatchClearNotesPayload, NotesCommand } from "./types";

/** Compile-time exhaustiveness guard for {@link NotesCommand}（新增分支时若漏实现会报错）。 */
function assertNeverNotesCommand(branch: never): never {
  throw new Error(`unreachable: unhandled NotesCommand branch (${String(branch)})`);
}

function cellInObviousConflict(state: GameState, r: number, c: number): boolean {
  return findObviousConflictPositions(state).some((p) => p.r === r && p.c === c);
}

function applyToggle(
  state: GameState,
  candidates: CandidatesGrid,
  r: number,
  c: number,
  digit: number,
): GameState {
  if (!isLegalToggleNote(state, r, c, digit)) {
    return cloneGameState(state);
  }
  if (cellInObviousConflict(state, r, c)) {
    return cloneGameState(state);
  }

  const next = cloneGameState(state);
  const cell = next.cells[r][c];
  const notes = cell.notes ?? new Set<number>();
  const had = notes.has(digit);

  if (had) {
    const copy = new Set(notes);
    copy.delete(digit);
    if (copy.size === 0) {
      delete cell.notes;
    } else {
      cell.notes = copy;
    }
    return next;
  }

  if (!candidates[r][c].has(digit)) {
    return cloneGameState(state);
  }

  const copy = new Set(notes);
  copy.add(digit);
  cell.notes = copy;
  return next;
}

function applyClearCell(state: GameState, r: number, c: number): GameState {
  if (!canModifyCell(state, r, c)) {
    return cloneGameState(state);
  }
  const next = cloneGameState(state);
  const cell = next.cells[r][c];
  if (cellIsSolved(cell)) {
    cell.notes = new Set();
  } else {
    delete cell.notes;
  }
  return next;
}

function applySetMode(
  state: GameState,
  candidates: CandidatesGrid,
  mode: "fill" | "notes",
): GameState {
  const next = cloneGameState(state);
  next.inputMode = mode;
  return syncNotesWithCandidates(next, candidates);
}

/**
 * 将 {@link BatchClearNotesPayload} 展开为 `(r,c)` 列表，顺序确定且与 `highlight-filter` 的宫/行/列遍历一致。
 */
function expandBatchClearCoords(payload: BatchClearNotesPayload): Array<{ r: number; c: number }> {
  if ("region" in payload) {
    const { region, index } = payload;
    const frozen =
      region === "row"
        ? cellsForRow(index)
        : region === "col"
          ? cellsForCol(index)
          : cellsForBox(index);
    return frozen.map((p) => ({ r: p.r, c: p.c }));
  }
  return [...payload.cells];
}

/**
 * 长按批量清除：对展开后的坐标列表**依次**处理（见 {@link BatchClearNotesPayload}）。
 * 对每一格：若 `canModifyCell` 为假则**跳过**；否则与 `clearCell` 相同地仅清除笔记（已解格写空 `Set`，未解格 `delete notes`）。
 * 全程在**单次** `cloneGameState` 结果上就地更新，最后对整个盘面调用 {@link syncNotesWithCandidates}。
 */
function applyBatchClear(
  state: GameState,
  payload: BatchClearNotesPayload,
  candidates: CandidatesGrid,
): GameState {
  const coords = expandBatchClearCoords(payload);
  const next = cloneGameState(state);
  for (const { r, c } of coords) {
    if (!canModifyCell(next, r, c)) {
      continue;
    }
    const cell = next.cells[r][c];
    if (cellIsSolved(cell)) {
      cell.notes = new Set();
    } else {
      delete cell.notes;
    }
  }
  return syncNotesWithCandidates(next, candidates);
}

/**
 * 将一条笔记命令应用到盘面（不可变更新）。已实现：`toggle`、`clearCell`、`setMode`、`batchClear`。
 * `undo` 不支持：请使用 `createUndoStack()`（见 `undo-stack.ts`）。
 */
export function applyNotesCommandImpl(
  state: GameState,
  cmd: NotesCommand,
  candidates: CandidatesGrid,
): GameState {
  switch (cmd.type) {
    case "toggle": {
      const { r, c, digit } = cmd.payload;
      return applyToggle(state, candidates, r, c, digit);
    }
    case "clearCell": {
      const { r, c } = cmd.payload;
      return applyClearCell(state, r, c);
    }
    case "setMode": {
      return applySetMode(state, candidates, cmd.payload.mode);
    }
    case "batchClear": {
      return applyBatchClear(state, cmd.payload, candidates);
    }
    case "undo":
      throw new Error(
        'applyNotesCommand does not handle { type: "undo" }. Push snapshots with createUndoStack().push(state) before mutating, then call createUndoStack().undo() to restore.',
      );
    default:
      return assertNeverNotesCommand(cmd);
  }
}

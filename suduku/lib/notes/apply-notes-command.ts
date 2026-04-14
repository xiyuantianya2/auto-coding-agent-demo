/**
 * `applyNotesCommand` 的实现分支（toggle / clearCell / setMode；其它命令类型由入口保留至后续任务）。
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
import type { NotesCommand } from "./types";

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
 * 将一条笔记命令应用到盘面（不可变更新）。已实现：`toggle`、`clearCell`、`setMode`；其余类型返回克隆快照。
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
    case "batchClear":
    case "undo":
      return cloneGameState(state);
  }
}

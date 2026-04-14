/**
 * 一键筛选高亮：由 {@link HighlightFilter} 推导 UI 可用的**不可变**坐标列表（纯函数，无模块级可变状态）。
 *
 * ## `digit` 筛选语义（固定）
 *
 * - `filter.index` ∈ 0…8 表示盘面数字 **d = index + 1**（与 {@link HighlightFilter} 类型注释一致）。
 * - 仅考虑**未解格**（与 `sync-notes` 一致：`given` / `value` 均未定义则视为可填「空格」；有 `given` 或 `value` 为已解，不参与 digit 高亮）。
 * - 未解格 **d** 被高亮当且仅当：
 *   - `candidates[r][c].has(d)`，**或**
 *   - `cell.notes` 存在且 `cell.notes.has(d)`。
 *
 * 若候选集与笔记暂时不一致（例如尚未调用 `syncNotesWithCandidates`），仍按上述**并集**规则高亮，以便 UI 反馈「仍可见」的铅笔或候选。
 */

import type { CellState, GameState } from "@/lib/core";
import { BOARD_SIZE, BOX_SIZE } from "@/lib/core";
import type { CandidatesGrid } from "@/lib/solver";

import type { HighlightFilter } from "./types";

/** 单格坐标（冻结对象，供 UI 安全缓存引用）。 */
export type HighlightCellCoord = Readonly<{ r: number; c: number }>;

/** `getHighlightCells` 的返回值：匹配格按**行优先**（r 升序，同 r 则 c 升序）排列。 */
export type NotesHighlightCells = Readonly<{
  cells: readonly HighlightCellCoord[];
}>;

function cellIsSolved(cell: CellState): boolean {
  return cell.given !== undefined || cell.value !== undefined;
}

function isValidLineIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BOARD_SIZE;
}

function freezeCoord(r: number, c: number): HighlightCellCoord {
  return Object.freeze({ r, c });
}

function freezeResult(coords: HighlightCellCoord[]): NotesHighlightCells {
  return Object.freeze({ cells: Object.freeze(coords) as readonly HighlightCellCoord[] });
}

/** 行优先：第 `rowIndex` 行上全部 9 格。 */
export function cellsForRow(rowIndex: number): readonly HighlightCellCoord[] {
  if (!isValidLineIndex(rowIndex)) {
    return Object.freeze([]);
  }
  const out: HighlightCellCoord[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    out.push(freezeCoord(rowIndex, c));
  }
  return Object.freeze(out);
}

/** 列优先遍历：第 `colIndex` 列上全部 9 格（r 从 0 递增）。 */
export function cellsForCol(colIndex: number): readonly HighlightCellCoord[] {
  if (!isValidLineIndex(colIndex)) {
    return Object.freeze([]);
  }
  const out: HighlightCellCoord[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    out.push(freezeCoord(r, colIndex));
  }
  return Object.freeze(out);
}

/**
 * 宫 `boxIndex`（0…8）内 9 格，**行优先**（与 `lib/core` `boxIndexFromCell` 的宫编号一致：
 * 宫 0 左上，向右递增列块，再换行块）。
 */
export function cellsForBox(boxIndex: number): readonly HighlightCellCoord[] {
  if (!isValidLineIndex(boxIndex)) {
    return Object.freeze([]);
  }
  const br = Math.floor(boxIndex / BOX_SIZE) * BOX_SIZE;
  const bc = (boxIndex % BOX_SIZE) * BOX_SIZE;
  const out: HighlightCellCoord[] = [];
  for (let i = 0; i < BOX_SIZE; i++) {
    for (let j = 0; j < BOX_SIZE; j++) {
      out.push(freezeCoord(br + i, bc + j));
    }
  }
  return Object.freeze(out);
}

/**
 * 根据当前筛选键、盘面与候选网格，返回用于高亮的格子坐标列表（新对象，不修改入参）。
 */
export function getHighlightCells(
  filter: HighlightFilter,
  state: GameState,
  candidates: CandidatesGrid,
): NotesHighlightCells {
  switch (filter.type) {
    case "row":
      return freezeResult([...cellsForRow(filter.index)]);
    case "col":
      return freezeResult([...cellsForCol(filter.index)]);
    case "box":
      return freezeResult([...cellsForBox(filter.index)]);
    case "digit": {
      if (!isValidLineIndex(filter.index)) {
        return freezeResult([]);
      }
      const digit = filter.index + 1;
      const acc: HighlightCellCoord[] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const cell = state.cells[r][c];
          if (cellIsSolved(cell)) continue;
          const cand = candidates[r][c];
          const inCand = cand.has(digit);
          const inNotes = cell.notes?.has(digit) ?? false;
          if (inCand || inNotes) {
            acc.push(freezeCoord(r, c));
          }
        }
      }
      return freezeResult(acc);
    }
  }
}

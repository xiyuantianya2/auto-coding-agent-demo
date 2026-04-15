/**
 * 全盘可解性：是否存在一整条消除序列能清空棋盘（与 link-game `full-solvability` 一致）。
 */

import { enumerateConnectablePairs } from "./connectivity";
import type { BoardGrid } from "./link_path";

export interface IsBoardFullySolvableOptions {
  readonly maxDfsNodes?: number;
}

function cloneBoard(board: BoardGrid): BoardGrid {
  return {
    rows: board.rows,
    cols: board.cols,
    cells: board.cells.map((row) => row.slice()),
  };
}

function isBoardEmpty(board: BoardGrid): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r]![c] !== null) return false;
    }
  }
  return true;
}

function dfsFullySolvable(board: BoardGrid, counter: { n: number; max: number } | null): boolean {
  if (isBoardEmpty(board)) return true;
  if (counter && counter.n >= counter.max) return false;
  if (counter) counter.n++;

  const pairs = enumerateConnectablePairs(board);
  for (const { a, b } of pairs) {
    const ra = board.cells[a.row];
    const rb = board.cells[b.row];
    if (!ra || !rb) continue;
    const va = ra[a.col];
    const vb = rb[b.col];
    if (va === null || vb === null) continue;

    ra[a.col] = null;
    rb[b.col] = null;
    if (dfsFullySolvable(board, counter)) return true;
    ra[a.col] = va;
    rb[b.col] = vb;
  }

  return false;
}

export function isBoardFullySolvable(board: BoardGrid, options?: IsBoardFullySolvableOptions): boolean {
  const working = cloneBoard(board);
  const max = options?.maxDfsNodes;
  const counter = max !== undefined ? { n: 0, max } : null;
  return dfsFullySolvable(working, counter);
}

import { EMPTY_CELL, type Board } from "./board-types";
import { findAllMatchPositions } from "./match-clear";
import type { AdjacentSwapAttemptResult, CellPos } from "./swap-types";

/**
 * 合法移动判定：
 *
 * 交换后，若任一被交换格落在 `match-clear` 所定义的「横向或纵向连续 ≥3 个同色」线段上，
 * 则视为触发三消并接受；否则拒绝并回滚。
 */

function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

function inBounds(board: Board, p: CellPos): boolean {
  return (
    p.row >= 0 &&
    p.col >= 0 &&
    p.row < board.length &&
    p.col < (board[0]?.length ?? 0)
  );
}

export function areOrthogonalAdjacent(board: Board, a: CellPos, b: CellPos): boolean {
  if (!inBounds(board, a) || !inBounds(board, b)) {
    return false;
  }
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

function cloneBoardMutable(board: Board): number[][] {
  return board.map((row) => [...row]);
}

function freezeBoard(grid: number[][]): Board {
  return grid.map((row) => Object.freeze([...row])) as Board;
}

/** 交换后，任一格是否处于与 `findAllMatchPositions` 一致的三消线段上 */
function swappedCellsInAnyMatch(board: Board, a: CellPos, b: CellPos): boolean {
  const matches = findAllMatchPositions(board);
  return matches.has(posKey(a.row, a.col)) || matches.has(posKey(b.row, b.col));
}

/**
 * 尝试在 a、b 两格之间做正交相邻交换。
 * - 非相邻、越界、同格：ignored，board 引用不变。
 * - 两格符号相同：rejected（无实际变化，不推进）。
 * - 交换后不能在被交换格上形成三消：rejected，board 回滚为原引用。
 * - 否则 accepted，返回新棋盘（不可变结构）。
 */
export function attemptAdjacentSwap(
  board: Board,
  a: CellPos,
  b: CellPos,
): AdjacentSwapAttemptResult {
  if (a.row === b.row && a.col === b.col) {
    return { kind: "ignored", board, reason: "same_cell" };
  }
  if (!inBounds(board, a) || !inBounds(board, b)) {
    return { kind: "ignored", board, reason: "out_of_bounds" };
  }
  if (!areOrthogonalAdjacent(board, a, b)) {
    return { kind: "ignored", board, reason: "not_orthogonal_adjacent" };
  }

  const va = board[a.row]![a.col]!;
  const vb = board[b.row]![b.col]!;
  if (va === EMPTY_CELL || vb === EMPTY_CELL) {
    return { kind: "ignored", board, reason: "empty_cell" };
  }
  if (va === vb) {
    return { kind: "rejected", board, reason: "same_symbol_noop" };
  }

  const next = cloneBoardMutable(board);
  next[a.row]![a.col] = vb;
  next[b.row]![b.col] = va;
  const trial = freezeBoard(next);

  if (!swappedCellsInAnyMatch(trial, a, b)) {
    return { kind: "rejected", board, reason: "no_match" };
  }

  return { kind: "accepted", board: trial };
}

/**
 * 在当前盘面寻找第一组「交换后可触发三消」的正交相邻格对（确定性顺序：先行后列，先右后下）。
 * 纯函数：不消耗随机种子，不改变盘面。
 */
export function findFirstValidSwap(
  board: Board,
): readonly [CellPos, CellPos] | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (c + 1 < cols) {
        const a: CellPos = { row: r, col: c };
        const b: CellPos = { row: r, col: c + 1 };
        if (attemptAdjacentSwap(board, a, b).kind === "accepted") {
          return [a, b];
        }
      }
      if (r + 1 < rows) {
        const a: CellPos = { row: r, col: c };
        const b: CellPos = { row: r + 1, col: c };
        if (attemptAdjacentSwap(board, a, b).kind === "accepted") {
          return [a, b];
        }
      }
    }
  }
  return null;
}

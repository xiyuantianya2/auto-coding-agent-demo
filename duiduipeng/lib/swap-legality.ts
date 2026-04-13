import { EMPTY_CELL, type Board, isEmptyCell } from "./board-types";
import type { AdjacentSwapAttemptResult, CellPos } from "./swap-types";

/**
 * 合法移动判定（任务 4，与任务 5/6 衔接）：
 *
 * - **三消**：交换后，若任一被交换格处于「横向或纵向连续 ≥3 个同色」线段上，则视为触发三消。
 * - **对碰合并（最小规则）**：若上述三消未触发，但任一被交换格在交换后与某一正交相邻格同色，
 *   则视为可触发对碰（任务 6 将定义合并结果与管线）。
 *
 * 仅检查两个被交换位置，避免盘面其他位置既有同色对误判为本次交换有效。
 */

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

/** 以 (r,c) 为中心，沿水平方向连续同色段长度（含自身） */
function horizontalRunLength(board: Board, row: number, col: number): number {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  if (row < 0 || col < 0 || row >= rows || col >= cols) {
    return 0;
  }
  const v = board[row]![col]!;
  if (isEmptyCell(v)) {
    return 0;
  }
  let c = col;
  while (c > 0 && board[row]![c - 1] === v) {
    c -= 1;
  }
  let len = 0;
  while (c < cols && board[row]![c] === v) {
    len += 1;
    c += 1;
  }
  return len;
}

/** 以 (r,c) 为中心，沿竖直方向连续同色段长度（含自身） */
function verticalRunLength(board: Board, row: number, col: number): number {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  if (row < 0 || col < 0 || row >= rows || col >= cols) {
    return 0;
  }
  const v = board[row]![col]!;
  if (isEmptyCell(v)) {
    return 0;
  }
  let r = row;
  while (r > 0 && board[r - 1]![col] === v) {
    r -= 1;
  }
  let len = 0;
  while (r < rows && board[r]![col] === v) {
    len += 1;
    r += 1;
  }
  return len;
}

function hasOrthogonalNeighborSame(board: Board, row: number, col: number): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const v = board[row]![col]!;
  if (isEmptyCell(v)) {
    return false;
  }
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) {
      continue;
    }
    if (board[nr]![nc] === v) {
      return true;
    }
  }
  return false;
}

/** 交换后该格是否触发三消或（在无三消时）对碰可合并的一对 */
function cellTriggersMatchOrMerge(board: Board, row: number, col: number): boolean {
  const h = horizontalRunLength(board, row, col);
  const v = verticalRunLength(board, row, col);
  if (h >= 3 || v >= 3) {
    return true;
  }
  return hasOrthogonalNeighborSame(board, row, col);
}

/**
 * 尝试在 a、b 两格之间做正交相邻交换。
 * - 非相邻、越界、同格：ignored，board 引用不变。
 * - 两格符号相同：rejected（无实际变化，不推进）。
 * - 交换后既不形成三消也不满足对碰最小规则：rejected，board 回滚为原引用。
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

  const okA = cellTriggersMatchOrMerge(trial, a.row, a.col);
  const okB = cellTriggersMatchOrMerge(trial, b.row, b.col);
  if (!okA && !okB) {
    return { kind: "rejected", board, reason: "no_match_or_merge" };
  }

  return { kind: "accepted", board: trial };
}

/**
 * 在当前盘面寻找第一组「交换后可触发三消或对碰」的正交相邻格对（确定性顺序：先行后列，先右后下）。
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

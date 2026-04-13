import { EMPTY_CELL, type Board, isEmptyCell } from "./board-types";

/** 三消基础分：每消除一格固定分；当局总分另含连锁加成（见 stabilization） */
export const BASE_SCORE_PER_CELL = 10;

function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * 扫描全盘，收集所有处于「横向或纵向连续 ≥3 个同色非空符号」线段上的格子（去重）。
 */
export function findAllMatchPositions(board: Board): ReadonlySet<string> {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const out = new Set<string>();

  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      const v = board[r]![c]!;
      if (isEmptyCell(v)) {
        c += 1;
        continue;
      }
      let len = 1;
      while (c + len < cols && board[r]![c + len] === v) {
        len += 1;
      }
      if (len >= 3) {
        for (let k = 0; k < len; k += 1) {
          out.add(posKey(r, c + k));
        }
      }
      c += len;
    }
  }

  for (let c = 0; c < cols; c += 1) {
    let r = 0;
    while (r < rows) {
      const v = board[r]![c]!;
      if (isEmptyCell(v)) {
        r += 1;
        continue;
      }
      let len = 1;
      while (r + len < rows && board[r + len]![c] === v) {
        len += 1;
      }
      if (len >= 3) {
        for (let k = 0; k < len; k += 1) {
          out.add(posKey(r + k, c));
        }
      }
      r += len;
    }
  }

  return out;
}

export function hasAnyMatch(board: Board): boolean {
  return findAllMatchPositions(board).size > 0;
}

/**
 * 将匹配格置为 {@link EMPTY_CELL}，并计算本回合基础分。
 * 无匹配时返回原棋盘引用，得分 0（稳定态，不进入消除循环）。
 */
export function applyMatchClear(board: Board): {
  readonly board: Board;
  readonly clearedCellCount: number;
  readonly score: number;
} {
  const positions = findAllMatchPositions(board);
  if (positions.size === 0) {
    return { board, clearedCellCount: 0, score: 0 };
  }

  const next = board.map((row) => [...row]);
  for (const key of positions) {
    const [rs, cs] = key.split(",").map(Number) as [number, number];
    next[rs]![cs] = EMPTY_CELL;
  }
  const frozen = next.map((row) => Object.freeze([...row])) as Board;
  const clearedCellCount = positions.size;
  return {
    board: frozen,
    clearedCellCount,
    score: clearedCellCount * BASE_SCORE_PER_CELL,
  };
}

import type { Board, CellCoord, PatternId } from "./types";

const DR = [-1, 0, 1, 0] as const;
const DC = [0, 1, 0, -1] as const;

/** 一对可连格子（`a` 在 `b` 之前：先按行再按列）。 */
export interface ConnectablePair {
  readonly a: CellCoord;
  readonly b: CellCoord;
}

function normalizePair(p: CellCoord, q: CellCoord): ConnectablePair {
  if (p.row < q.row || (p.row === q.row && p.col < q.col)) {
    return { a: p, b: q };
  }
  return { a: q, b: p };
}

/**
 * 判断两格是否可按连连看规则连通：仅上下左右移动，转弯不超过 2 次，
 * 路径中间格须为空；棋盘边界外视为空（用一圈 padding 表示）。
 * 端点两格图案需相同；寻路时两端临时视为空以便穿过。
 */
export function canConnect(a: CellCoord, b: CellCoord, board: Board): boolean {
  const pa = board.cells[a.row]?.[a.col] ?? null;
  const pb = board.cells[b.row]?.[b.col] ?? null;
  if (pa === null || pb === null || pa !== pb) return false;
  if (a.row === b.row && a.col === b.col) return false;

  const rows = board.rows;
  const cols = board.cols;
  const pr = rows + 2;
  const pc = cols + 2;

  const pad: (PatternId | null)[][] = Array.from({ length: pr }, () =>
    Array<PatternId | null>(pc).fill(null),
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pad[r + 1][c + 1] = board.cells[r][c];
    }
  }

  pad[a.row + 1][a.col + 1] = null;
  pad[b.row + 1][b.col + 1] = null;

  const sr = a.row + 1;
  const sc = a.col + 1;
  const er = b.row + 1;
  const ec = b.col + 1;

  type Node = readonly [number, number, number, number];
  const queue: Node[] = [[sr, sc, -1, 0]];
  const seen = new Set<string>();

  let head = 0;
  while (head < queue.length) {
    const [r, c, lastDir, bends] = queue[head++];

    const key = `${r},${c},${lastDir},${bends}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (r === er && c === ec) return true;

    for (let d = 0; d < 4; d++) {
      const nr = r + DR[d];
      const nc = c + DC[d];
      if (nr < 0 || nr >= pr || nc < 0 || nc >= pc) continue;
      if (pad[nr][nc] !== null) continue;

      let nb = bends;
      if (lastDir !== -1 && d !== lastDir) nb++;
      if (nb > 2) continue;

      queue.push([nr, nc, d, nb]);
    }
  }

  return false;
}

/**
 * 枚举棋盘上所有「同图案且可连通」的无序格对（每对只出现一次，`a` 先于 `b`）。
 * 供提示等功能在剩余棋子中任选一对可消组合。
 */
export function enumerateConnectablePairs(board: Board): ConnectablePair[] {
  const byPattern = new Map<number, CellCoord[]>();

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r][c];
      if (v === null) continue;
      let list = byPattern.get(v);
      if (!list) {
        list = [];
        byPattern.set(v, list);
      }
      list.push({ row: r, col: c });
    }
  }

  const out: ConnectablePair[] = [];
  for (const coords of byPattern.values()) {
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const p = coords[i];
        const q = coords[j];
        if (canConnect(p, q, board)) {
          out.push(normalizePair(p, q));
        }
      }
    }
  }

  return out;
}

/**
 * 棋盘上是否存在至少一对「同图案且可连通」的格子（用于开局「至少一步可消」检查）。
 *
 * 这不等于「全盘可按某种顺序消至空盘」；全局可解性见 `isBoardFullySolvable`（`./full-solvability`）。
 */
export function hasAtLeastOneConnectablePair(board: Board): boolean {
  const byPattern = new Map<number, CellCoord[]>();

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r][c];
      if (v === null) continue;
      let list = byPattern.get(v);
      if (!list) {
        list = [];
        byPattern.set(v, list);
      }
      list.push({ row: r, col: c });
    }
  }

  for (const coords of byPattern.values()) {
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        if (canConnect(coords[i], coords[j], board)) return true;
      }
    }
  }

  return false;
}

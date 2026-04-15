/**
 * 枚举可连同图案对（与 Godot `LinkPathFinder` / `findLinkPath` 语义一致）。
 */

import { findLinkPath, type BoardGrid, type CellCoord } from "./link_path";

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

export function canConnect(a: CellCoord, b: CellCoord, board: BoardGrid): boolean {
  return findLinkPath(a, b, board).ok;
}

/**
 * 枚举棋盘上所有「同图案且可连通」的无序格对（每对只出现一次，`a` 先于 `b`）。
 */
export function enumerateConnectablePairs(board: BoardGrid): ConnectablePair[] {
  const byPattern = new Map<number, CellCoord[]>();

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r]?.[c] ?? null;
      if (v === null) continue;
      const id = v as number;
      let list = byPattern.get(id);
      if (!list) {
        list = [];
        byPattern.set(id, list);
      }
      list.push({ row: r, col: c });
    }
  }

  const out: ConnectablePair[] = [];
  for (const coords of byPattern.values()) {
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const p = coords[i]!;
        const q = coords[j]!;
        if (canConnect(p, q, board)) {
          out.push(normalizePair(p, q));
        }
      }
    }
  }

  return out;
}

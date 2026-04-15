/**
 * 提示（首对可连同图案）与洗牌（保持 multiset、尽力保持全盘可解）。
 * 与 `scripts/link_game_solvability.gd` / `scripts/board_layout_generator.gd` 语义对齐。
 */

import { shuffleInPlace } from "./board_layout_generator";
import { enumerateConnectablePairs, type ConnectablePair } from "./connectivity";
import { isBoardFullySolvable } from "./full_solvability";
import type { BoardGrid } from "./link_path";

const DEFAULT_MAX_ATTEMPTS = 120;
const DEFAULT_DFS_RANDOM = 400_000;

export function findFirstConnectablePair(board: BoardGrid): ConnectablePair | null {
  const pairs = enumerateConnectablePairs(board);
  return pairs.length > 0 ? pairs[0]! : null;
}

export function reshuffleOccupiedCellsSolvable(
  board: BoardGrid,
  rng: () => number,
  options?: { maxAttempts?: number; maxDfsNodes?: number },
): boolean {
  const positions: { row: number; col: number }[] = [];
  const values: number[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r]?.[c];
      if (v === null || v === undefined) continue;
      positions.push({ row: r, col: c });
      values.push(v);
    }
  }
  if (values.length <= 1) return true;

  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxDfs = options?.maxDfsNodes ?? DEFAULT_DFS_RANDOM;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    shuffleInPlace(values, rng);
    for (let i = 0; i < values.length; i++) {
      const p = positions[i]!;
      const row = board.cells[p.row];
      if (!row) return false;
      row[p.col] = values[i]!;
    }
    if (isBoardFullySolvable(board, { maxDfsNodes: maxDfs })) {
      return true;
    }
  }
  return false;
}

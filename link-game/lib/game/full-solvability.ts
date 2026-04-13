import { enumerateConnectablePairs } from "./connectivity";
import type { Board } from "./types";

/**
 * 全盘可解性（global solvability）与 `hasAtLeastOneConnectablePair`（见 `./connectivity`）的语义差异：
 *
 * - **`hasAtLeastOneConnectablePair`**：只看**当前**盘面，是否存在**至少一对**同图案且按 `canConnect` 可连的子。
 *   这是「一步内存在合法首消」的**局部**条件。
 *
 * - **`isBoardFullySolvable`**：是否存在**一整条**消除序列：每一步任选一对当前可连同图案子并消除（与实机规则一致），
 *   递归若干步后盘面**变为全空**。这是「存在完整解」的**全局**判定。
 *
 * 二者关系：若全盘可解，则第一步必有某对可连（除非已空盘）；但反之不成立——可能当前仍有可连对，
 * 却没有任何顺序能消完（先消错一对会把剩余棋子锁死成死局）。
 *
 * **空盘**（所有格均为 `null`）：视为可解（`true`），因为目标「清空」已达成，无需再走任何一步。
 */
export function isBoardFullySolvable(board: Board): boolean {
  const working = cloneBoard(board);
  return dfsFullySolvable(working);
}

function cloneBoard(board: Board): Board {
  return {
    rows: board.rows,
    cols: board.cols,
    cells: board.cells.map((row) => row.slice()),
  };
}

function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r][c] !== null) return false;
    }
  }
  return true;
}

/**
 * 回溯：枚举当前所有可消对（与 `enumerateConnectablePairs` / `canConnect` 一致），
 * 依次尝试消除并递归，直至空盘成功或所有分支失败。
 */
function dfsFullySolvable(board: Board): boolean {
  if (isBoardEmpty(board)) return true;

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
    if (dfsFullySolvable(board)) return true;
    ra[a.col] = va;
    rb[b.col] = vb;
  }

  return false;
}

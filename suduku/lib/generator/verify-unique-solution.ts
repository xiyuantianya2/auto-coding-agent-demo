import type { Grid9 } from "../core";
import { BOARD_SIZE, DIGIT_MAX, DIGIT_MIN, EMPTY_CELL, isValidPlacement } from "../core";

/**
 * 判定 `givens` 在标准数独规则下是否**恰好有一个**完整填数解。
 *
 * **算法：** 对空格做深度优先回溯，累计解个数；一旦达到 2 即停止（多解与无解均不满足「唯一」）。
 *
 * **最坏情况：** 理论上需遍历指数级搜索树（空格极多时接近「每位最多 9 种」的分支积）；实际中
 * {@link isValidPlacement} 在每位剪去大量非法分支。若仅需唯一性判定，计数上限为 2，找到第二解即可退出。
 *
 * **剪枝：** (1) 填入前用 `isValidPlacement` 拒绝与行/列/宫冲突的数字；(2) 解数达到 2 提前终止；
 * (3) 先校验提示面自带冲突，避免在明显无解盘上深搜。
 */
export function verifyUniqueSolution(givens: Grid9): boolean {
  if (!isWellFormedGrid9(givens)) return false;
  const grid = givens.map((row) => [...row]) as Grid9;
  if (!givensInternallyConsistent(grid)) return false;
  return countSolutionsUpTo(grid, 2) === 1;
}

function isWellFormedGrid9(grid: unknown): grid is Grid9 {
  if (!Array.isArray(grid) || grid.length !== BOARD_SIZE) return false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = grid[r];
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) return false;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = row[c];
      if (typeof v !== "number" || !Number.isInteger(v) || v < EMPTY_CELL || v > DIGIT_MAX) {
        return false;
      }
    }
  }
  return true;
}

/** 每个非空格上的数字与同行/列/宫其它已填数字无冲突。 */
function givensInternallyConsistent(grid: Grid9): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = grid[r][c];
      if (v === EMPTY_CELL) continue;
      if (v < DIGIT_MIN || !isValidPlacement(grid, r, c, v)) return false;
    }
  }
  return true;
}

function findFirstEmptyIndex(grid: Grid9): number {
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const r = Math.floor(i / BOARD_SIZE);
    const c = i % BOARD_SIZE;
    if (grid[r][c] === EMPTY_CELL) return i;
  }
  return -1;
}

/** @returns 解的个数，最多数到 `limit`（含），用于唯一性时取 `limit === 2` 即可。 */
function countSolutionsUpTo(grid: Grid9, limit: number): number {
  const idx = findFirstEmptyIndex(grid);
  if (idx === -1) return 1;

  let count = 0;
  const r = Math.floor(idx / BOARD_SIZE);
  const c = idx % BOARD_SIZE;

  for (let n = DIGIT_MIN; n <= DIGIT_MAX; n++) {
    if (!isValidPlacement(grid, r, c, n)) continue;
    grid[r][c] = n;
    count += countSolutionsUpTo(grid, limit);
    grid[r][c] = EMPTY_CELL;
    if (count >= limit) return count;
  }
  return count;
}

/**
 * 随机合法**终盘**（81 格均为 `1`–`9` 的完整 {@link Grid9}），供后续挖空使用。
 *
 * **策略**：先在三块对角 `3×3` 宫内各填入 `1`–`9` 的一个随机排列（彼此不相交，恒合法），
 * 再对其余空格做**随机顺序数字**的回溯填充；若单轮搜索超出步数上限则整盘重试（换对角排列与搜索路径）。
 *
 * **随机源**：仅消费任务 2 约定的 `rng: () => number`（`[0, 1)` 均匀）。
 */

import { createEmptyGrid9, EMPTY_CELL, isValidPlacement, type Grid9 } from "../core";

/** 单次回溯搜索允许的最大试探步数（防止异常路径拖死主线程）。 */
const MAX_FILL_STEPS_PER_ATTEMPT = 8_000_000;

/** 终盘生成外层重试次数（对角排列 + 回溯失败时换一盘）。 */
const MAX_GRID_ATTEMPTS = 128;

function shuffleIntRangeInclusive(min: number, max: number, rng: () => number): number[] {
  const a: number[] = [];
  for (let n = min; n <= max; n++) a.push(n);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** 三块对角宫左上角 `(br, bc)`：宫 0、4、8。 */
const DIAGONAL_BOX_TOP_LEFTS: Array<[number, number]> = [
  [0, 0],
  [3, 3],
  [6, 6],
];

function seedDiagonalBoxes(grid: Grid9, rng: () => number): void {
  for (const [br, bc] of DIAGONAL_BOX_TOP_LEFTS) {
    const perm = shuffleIntRangeInclusive(1, 9, rng);
    let k = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        grid[br + i]![bc + j] = perm[k]!;
        k++;
      }
    }
  }
}

/**
 * 在已部分填好的 `grid` 上回溯补全；成功返回 `true` 并保持 `grid` 为解，失败则恢复为进入前状态并返回 `false`。
 */
function fillRemaining(
  grid: Grid9,
  rng: () => number,
  steps: { count: number },
): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c] !== EMPTY_CELL) continue;

      const order = shuffleIntRangeInclusive(1, 9, rng);
      for (const d of order) {
        steps.count++;
        if (steps.count > MAX_FILL_STEPS_PER_ATTEMPT) {
          return false;
        }
        if (!isValidPlacement(grid, r, c, d)) continue;
        grid[r]![c] = d;
        if (fillRemaining(grid, rng, steps)) {
          return true;
        }
        grid[r]![c] = EMPTY_CELL;
      }
      return false;
    }
  }
  return true;
}

/**
 * 生成一個填满且满足标准数独规则的终盘。
 *
 * @throws Error 若在 {@link MAX_GRID_ATTEMPTS} 次尝试内仍无法产出完整合法盘面（理论上极低概率）。
 */
export function generateCompleteGrid(rng: () => number): Grid9 {
  for (let attempt = 0; attempt < MAX_GRID_ATTEMPTS; attempt++) {
    const grid = createEmptyGrid9();
    seedDiagonalBoxes(grid, rng);
    const steps = { count: 0 };
    if (fillRemaining(grid, rng, steps)) {
      return grid;
    }
  }

  throw new Error(
    `puzzle-generator: generateCompleteGrid failed after ${MAX_GRID_ATTEMPTS} attempts (try a different rng stream)`,
  );
}

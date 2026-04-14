import type { Grid9 } from "@/lib/core";
import { EMPTY_CELL, GRID_SIZE, MAX_DIGIT, MIN_DIGIT } from "@/lib/core";

import { cloneGrid9 } from "./grid-game-state";
import { verifyUniqueSolution } from "./unique-solution";

/** 单次挖洞流程的默认墙上时钟预算（毫秒），与模块「单次生成约 5 秒」一致。 */
export const DEFAULT_DIG_HOLES_TIMEOUT_MS = 5000;

/**
 * 防止异常情况下无限循环的「尝试挖空」步数上限（与 81 格上限一致即可）。
 */
const MAX_DIG_ATTEMPTS = 81;

function isCompleteValidSolution(grid: Grid9): boolean {
  if (!Array.isArray(grid) || grid.length !== GRID_SIZE) {
    return false;
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = grid[r];
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      return false;
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = row[c];
      if (
        typeof v !== "number" ||
        !Number.isInteger(v) ||
        v < MIN_DIGIT ||
        v > MAX_DIGIT
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Fisher–Yates：返回 `0..n-1` 的一个随机排列。
 */
function shuffleIndexRange(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export type DigHolesFromCompleteSolutionOptions = {
  /** 完整有效解（每格 1–9）。 */
  solution: Grid9;
  /** 与 `[0, 1)` 一致的伪随机源，用于打乱挖洞顺序。 */
  rng: () => number;
  /**
   * 本轮挖洞的墙上时钟预算（毫秒）。与 {@link verifyUniqueSolution} 内部的 DFS/时钟预算独立：
   * 超时时中止本轮尝试并返回当前盘面（仅保留已通过唯一性校验的挖洞）。
   */
  timeoutMs?: number;
};

/**
 * 在完整解盘面上按随机顺序尝试「挖洞」（置 `0`），每格尝试后调用 {@link verifyUniqueSolution}；
 * 若不再唯一则回退该格。
 *
 * 不追求最少提示数：超时或验证器返回「无法在预算内证明唯一」时均回退该步，故可能保留较多提示。
 *
 * @returns 始终返回有效提示 {@link Grid9}（在输入为完整解的前提下，输出在验证器预算内为唯一解）；
 *          若 `solution` 非完整有效解则返回 `null`。
 */
export function digHolesFromCompleteSolution(
  options: DigHolesFromCompleteSolutionOptions,
): Grid9 | null {
  const { solution, rng } = options;
  const budgetMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(0, options.timeoutMs)
      : DEFAULT_DIG_HOLES_TIMEOUT_MS;

  if (!isCompleteValidSolution(solution)) {
    return null;
  }

  const g = cloneGrid9(solution);
  const order = shuffleIndexRange(GRID_SIZE * GRID_SIZE, rng);
  const t0 = Date.now();
  const deadline = t0 + budgetMs;

  let attempts = 0;
  for (const flat of order) {
    if (attempts >= MAX_DIG_ATTEMPTS) {
      break;
    }
    if (Date.now() >= deadline) {
      break;
    }

    const r = Math.floor(flat / GRID_SIZE);
    const c = flat % GRID_SIZE;
    const cell = g[r]![c]!;
    if (cell === EMPTY_CELL) {
      continue;
    }

    attempts++;
    g[r]![c] = EMPTY_CELL;

    if (Date.now() >= deadline) {
      g[r]![c] = cell;
      break;
    }

    if (!verifyUniqueSolution(g)) {
      g[r]![c] = cell;
    }
  }

  return g;
}

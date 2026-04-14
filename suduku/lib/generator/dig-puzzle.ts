/**
 * 在合法**终盘**上按随机顺序挖空，使提示面在标准规则下仍**唯一解**。
 *
 * ## 「最少提示」产品语义（本任务固定）
 *
 * - **档位下界**：对 `tier`，当盘面上「给定格」数量（值 ∈ 1..9 的格子数）已达到
 *   {@link DIFFICULTY_TIER_CONFIG}`[tier].givensCount.min` 时，**不再**尝试删格（避免低于产品配置的最少提示数）。
 * - **单轮顺序贪心**：将 81 格下标按 `rng` 打乱后**单向扫描**一遍；对每一格若可清空且清空后仍
 *   `verifyUniqueSolution === true` 则保留清空，否则回退。**不保证**全局「再删任意一格必多解」的
 *   局部极小（顺序敏感）；但保证输出**从未**采纳会导致多解或无解的删格。
 * - **唯一解不变式**：任一步 `verifyUniqueSolution` 为假则恢复该格数字，故公开返回的 `Grid9` 恒为唯一解
 *   （在未满额上限的前提下）。
 */

import type { DifficultyTier, Grid9 } from "../core";
import { DIGIT_MAX, DIGIT_MIN, EMPTY_CELL } from "../core";

import { DIFFICULTY_TIER_CONFIG } from "./difficulty-tier-config";
import { verifyUniqueSolution } from "./verify-unique-solution";

const DEFAULT_MAX_UNIQUE_CHECKS = 50_000;

function shuffleIndex81(rng: () => number): number[] {
  const a: number[] = [];
  for (let i = 0; i < 81; i++) a.push(i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function cloneGrid9(grid: Grid9): Grid9 {
  return grid.map((row) => [...row]) as Grid9;
}

function countGivens(grid: Grid9): number {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = grid[r]![c]!;
      if (v >= DIGIT_MIN && v <= DIGIT_MAX) n++;
    }
  }
  return n;
}

export type DigPuzzleFromSolutionOptions = {
  /** 任务 4 风格的完整合法终盘（81 格均为 1–9）。 */
  completedGrid: Grid9;
  /** 用于读取该档最少提示下界 {@link DIFFICULTY_TIER_CONFIG}[tier].givensCount.min。 */
  tier: DifficultyTier;
  /**
   * 覆盖「删格停止」时的**最少保留给定数**（与 `givensCount.min` 语义相同：当盘面上 1–9 格数 `<=` 该值时不再尝试删格）。
   * 例如 `easy` 与 {@link generatePuzzle} 可设为 `givensCount.max`，保留更多提示以利于「仅裸单/隐单」链式可解。
   */
  minGivensStopOverride?: number;
  /** `[0, 1)` 均匀随机源，用于打乱删格顺序。 */
  rng: () => number;
  /**
   * 最多调用 {@link verifyUniqueSolution} 的次数（含每一步尝试）。
   * 超出则**立即**返回当前盘面（仍为唯一解）。默认 {@link DEFAULT_MAX_UNIQUE_CHECKS}。
   */
  maxUniqueChecks?: number;
  /**
   * 可选墙上时钟上限（毫秒），自函数入口起算；超出则返回当前盘面（仍为唯一解）。
   * 未定义表示不限制。
   */
  maxElapsedMs?: number;
};

/**
 * 从完整终盘挖空得到提示面 `Grid9`（`0` 为空格）。不修改入参 `completedGrid`。
 *
 * 不计算难度分、不调用 solver 技巧枚举；仅依赖 {@link verifyUniqueSolution}。
 */
export function digPuzzleFromSolution(options: DigPuzzleFromSolutionOptions): Grid9 {
  const {
    completedGrid,
    tier,
    rng,
    maxUniqueChecks = DEFAULT_MAX_UNIQUE_CHECKS,
    maxElapsedMs,
  } = options;

  const grid = cloneGrid9(completedGrid);
  const gc = DIFFICULTY_TIER_CONFIG[tier].givensCount;
  const minGivens = Math.min(
    gc.max,
    Math.max(gc.min, options.minGivensStopOverride ?? gc.min),
  );

  const t0 =
    maxElapsedMs !== undefined && typeof performance !== "undefined"
      ? performance.now()
      : undefined;

  let checks = 0;

  const order = shuffleIndex81(rng);

  for (const flat of order) {
    if (countGivens(grid) <= minGivens) break;
    if (checks >= maxUniqueChecks) break;
    if (t0 !== undefined && maxElapsedMs !== undefined && typeof performance !== "undefined") {
      if (performance.now() - t0 > maxElapsedMs) break;
    }

    const r = Math.floor(flat / 9);
    const c = flat % 9;
    const v = grid[r]![c]!;
    if (v === EMPTY_CELL) continue;

    grid[r]![c] = EMPTY_CELL;
    checks++;
    if (!verifyUniqueSolution(grid)) {
      grid[r]![c] = v;
    }
  }

  return grid;
}

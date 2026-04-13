/**
 * @packageDocumentation
 * 「唯一解题目生成与难度分档」模块的**公共入口**（路径以 `tsconfig` 的 `@/*` 为准，例如 `@/lib/generator`）。
 *
 * **与 `module-plan.json` 中本模块 `interface` 一致：**
 *
 * `type DifficultyTier = 'easy'|'normal'|'hard'|'hell'; type PuzzleSpec = { seed: string; givens: Grid9; difficultyScore: number; requiredTechniques: TechniqueId[] }; function generatePuzzle(options: { tier: DifficultyTier; rng: () => number }): PuzzleSpec; function verifyUniqueSolution(givens: Grid9): boolean;`
 *
 * **职责边界与 solver-engine 协作（骨架阶段）：**
 *
 * - **`generatePuzzle`** — 负责从随机流产出唯一解题目与元数据。完整实现将把 `givens` 转为 `GameState`（见 `lib/core` 工厂）后，调用 `lib/solver` 的 `computeCandidates`、`findTechniques` 迭代求解路径，并用 `scoreDifficulty` 得到 `difficultyScore`，汇总步骤中的 `TechniqueId` 为 `requiredTechniques`。求解引擎**不**负责生成题目，只消费已定稿的提示面。
 * - **`verifyUniqueSolution`** — 判定标准数独规则下完整解个数是否为 1；实现上通常用搜索/计数，**不必**调用 `findTechniques`。与 solver 的分工：唯一性属于生成管线的前置/校验步骤，技巧枚举用于难度标注与分档。
 */

import type { DifficultyTier, Grid9 } from "../core";
import type { TechniqueId } from "../solver";

import {
  PUZZLE_SEED_HEX_DIGITS,
  createMulberry32,
  createRngFromSeed,
  derivePuzzleSeedString,
  isValidPuzzleSeedString,
} from "./rng";

export type { DifficultyTier } from "../core";

export { verifyUniqueSolution } from "./verify-unique-solution";

export { generateCompleteGrid } from "./complete-grid";

export {
  digPuzzleFromSolution,
  type DigPuzzleFromSolutionOptions,
} from "./dig-puzzle";

export {
  DIFFICULTY_TIER_CONFIG,
  DIFFICULTY_TIER_ORDER,
  DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY,
  allowedTechniquesForTier,
  type DifficultyTierConfigEntry,
  type TierDifficultyScoreRange,
  type TierGivensConstraint,
} from "./difficulty-tier-config";

export {
  PUZZLE_SEED_HEX_DIGITS,
  createMulberry32,
  createRngFromSeed,
  derivePuzzleSeedString,
  isValidPuzzleSeedString,
};

const EMPTY_GRID: Grid9 = Array.from({ length: 9 }, () => Array(9).fill(0)) as Grid9;

/**
 * 一道可复现题目的规格：`givens` 与 core 的 {@link Grid9} 一致（`0` 为空格，`1`–`9` 为给定数字）。
 */
export type PuzzleSpec = {
  seed: string;
  givens: Grid9;
  difficultyScore: number;
  requiredTechniques: TechniqueId[];
};

/**
 * 按目标难度档生成唯一解题目与元数据（当前仅建立可复现 `seed` 与空盘面占位，终盘/挖空/打分在后续任务接入）。
 *
 * 完整实现将依赖 `lib/solver` 的 `computeCandidates`、`findTechniques`、`scoreDifficulty` 为结果打分并收集 `requiredTechniques`。
 *
 * @param options.tier — 目标难度档（与 core 的 {@link DifficultyTier} 一致；完整生成算法尚未接入，当前仅保留参数）。
 * @param options.rng — 注入的 `[0, 1)` 随机源；本函数会调用若干次以确定 {@link PuzzleSpec.seed}（见 {@link derivePuzzleSeedString}）。可复现要求：使用 {@link createRngFromSeed} 从同一 seed 构造 `rng`，或直接使用返回的 `PuzzleSpec.seed` 与 `createRngFromSeed` 复现后续随机流。
 * @returns 题目规格；`seed` 为 32 位小写十六进制 canonical 字符串，后续任务将在此基础上填充终盘与挖空逻辑。
 */
export function generatePuzzle(options: {
  tier: DifficultyTier;
  rng: () => number;
}): PuzzleSpec {
  void options.tier;
  const seed = derivePuzzleSeedString(options.rng);
  return {
    seed,
    givens: EMPTY_GRID,
    difficultyScore: 0,
    requiredTechniques: [],
  };
}


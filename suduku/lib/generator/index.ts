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

export type { PuzzleSpec } from "./puzzle-spec";

export {
  GENERATE_PUZZLE_MAX_ATTEMPTS,
  generatePuzzle,
} from "./generate-puzzle";


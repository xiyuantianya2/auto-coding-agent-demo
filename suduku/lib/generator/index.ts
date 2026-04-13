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

export type { DifficultyTier } from "../core";

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
 * 按目标难度档生成唯一解题目与元数据（占位：尚未实现生成算法）。
 *
 * 完整实现将依赖 `lib/solver` 的 `computeCandidates`、`findTechniques`、`scoreDifficulty` 为结果打分并收集 `requiredTechniques`。
 *
 * @param options.tier — 目标难度档（与 core 的 {@link DifficultyTier} 一致）。
 * @param options.rng — 注入的随机数发生器 `[0, 1)`；与 `PuzzleSpec.seed` 的对应关系由后续任务约定。
 * @returns 题目规格（当前为占位，成功路径尚未实现）。
 * @throws 在占位阶段始终抛出，提示尚未实现。
 */
export function generatePuzzle(options: {
  tier: DifficultyTier;
  rng: () => number;
}): PuzzleSpec {
  void options;
  throw new Error("puzzle-generator: generatePuzzle is not implemented yet");
}

/**
 * 判定 `givens` 在标准数独规则下是否**恰好有一个**完整解（占位：尚未实现判定逻辑）。
 *
 * 与 `lib/solver`：`findTechniques` / `scoreDifficulty` 用于分析给定盘面，不替代唯一解计数；本函数实现可不调用技巧引擎。
 *
 * @param givens — 9×9 提示面，语义与 core 的 {@link Grid9} 一致。
 * @returns `true` 当且仅当唯一解（占位阶段不会返回）。
 * @throws 在占位阶段始终抛出，提示尚未实现。
 */
export function verifyUniqueSolution(givens: Grid9): boolean {
  void givens;
  throw new Error("puzzle-generator: verifyUniqueSolution is not implemented yet");
}

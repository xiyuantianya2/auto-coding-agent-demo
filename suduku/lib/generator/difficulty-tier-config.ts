/**
 * 四档难度（`DifficultyTier`）的**集中配置**：技巧层级上限、与 {@link scoreDifficulty} 配合的分数区间、以及挖空阶段的给定数（提示）数量约束。
 *
 * ## 与 `scoreDifficulty`（`lib/solver`）对齐时的区间校准
 *
 * `scoreDifficulty` 对步骤序列做**可复现的加权和**（见 `lib/solver/score-difficulty.ts`）：每步含
 * `TECHNIQUE_WEIGHT[technique]`、固定步长开销、以及 eliminations / highlights 奖励。因此**同一档**内实际分数会随
 * 解题步数与消除规模波动。
 *
 * **推荐调参流程（本文件仅保留结果区间，公式不变）：**
 *
 * 1. 对每档用接近定稿的生成管线产出若干 `givens`，用 solver 跑出**权威** `SolveStep[]`，再调用 `scoreDifficulty`。
 * 2. 统计各档分数的分位数（如 P10–P90），将本文件的 `difficultyScoreRange.min/max` 设为能覆盖目标样本的闭区间；
 *    若边界样本过少，可略扩区间或略增 `generatePuzzle` 重试次数。
 * 3. 若需与「技巧最高阶」同时约束，优先保证 `maxTechniqueResolutionOrderIndex` 与注册表一致，再微调分数区间，
 *    避免为迁就分数而放宽技巧上限（产品语义：地狱档应允许鱼形/链式等）。
 *
 * 当前分数区间在档与档之间**刻意留出间隙**（互不重叠），便于分档断言；若未来改为允许边界重叠，请在
 * {@link DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY} 中写明策略并同步更新单元测试。
 *
 * **`easy` 与累加分数：**`generatePuzzle` 对 `easy` 使用「裸单/隐单链」全路径调用 `scoreDifficulty`（`lib/solver`），累加分会随步数
 * 增长，可能**高于**本表 `easy.difficultyScoreRange.max`；验收时以「仅允许裸单/隐单且链式可解」为主，分数区间主要用于
 * `normal`/`hard`/`hell`（见 `generate-puzzle.ts`）。
 */

import type { DifficultyTier } from "../core";
import type { TechniqueId } from "../solver";
import { TECHNIQUE_RESOLUTION_ORDER } from "../solver";

/** 全档难度分数区间是否允许相邻档在端点重叠；当前为 `none`（严格分离）。 */
export const DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY = "none" as const;

/** 便于遍历与比较顺序（由易到难）。 */
export const DIFFICULTY_TIER_ORDER: readonly DifficultyTier[] = [
  "easy",
  "normal",
  "hard",
  "hell",
];

/** `scoreDifficulty` 输出的可接受闭区间（与 {@link DIFFICULTY_TIER_SCORE_RANGE_OVERLAP_POLICY} 一致）。 */
export type TierDifficultyScoreRange = {
  min: number;
  max: number;
};

/** 给定数字格子数量（`Grid9` 中值为 1–9 的格数）约束；用于挖空停止条件与上限。 */
export type TierGivensConstraint = {
  /** 至少保留的提示数（达到后可停止继续删数，见任务 6）。 */
  min: number;
  /** 至多保留的提示数（避免过多提示导致分档失真；生成时可作为初始挖空前上限参考）。 */
  max: number;
};

export type DifficultyTierConfigEntry = {
  tier: DifficultyTier;
  /**
   * 在 {@link TECHNIQUE_RESOLUTION_ORDER} 中的**包容**上界下标：允许出现的技巧为下标 `0..max`（含）。
   * 与 `TECHNIQUE_WEIGHT` 中技巧权重递增大体一致，且与引擎内解析优先级表顺序对齐。
   */
  maxTechniqueResolutionOrderIndex: number;
  difficultyScoreRange: TierDifficultyScoreRange;
  givensCount: TierGivensConstraint;
};

/**
 * 各难度档一行配置；键与 {@link DifficultyTier} 一致。
 *
 * 分数区间初值按「低阶技巧步为主 / 高阶技巧步为主」的量级估算，并留档间空隙；后续应用任务 7 的生成结果校准。
 */
export const DIFFICULTY_TIER_CONFIG: Readonly<
  Record<DifficultyTier, DifficultyTierConfigEntry>
> = {
  easy: {
    tier: "easy",
    maxTechniqueResolutionOrderIndex: 1,
    difficultyScoreRange: { min: 0, max: 420 },
    givensCount: { min: 35, max: 46 },
  },
  normal: {
    tier: "normal",
    maxTechniqueResolutionOrderIndex: 5,
    difficultyScoreRange: { min: 421, max: 1150 },
    givensCount: { min: 28, max: 40 },
  },
  hard: {
    tier: "hard",
    /** 与首层 `findTechniques` 快照一致：允许至 `xy-wing`（索引 9）；地狱档同技巧上界，以分数区间区分。 */
    maxTechniqueResolutionOrderIndex: 9,
    difficultyScoreRange: { min: 1151, max: 2199 },
    givensCount: { min: 22, max: 34 },
  },
  hell: {
    tier: "hell",
    maxTechniqueResolutionOrderIndex: 9,
    difficultyScoreRange: { min: 2200, max: 1_000_000 },
    givensCount: { min: 17, max: 28 },
  },
} as const;

/**
 * 返回该档**允许出现**的技巧 id 列表（按引擎解析顺序的前缀切片）。
 */
export function allowedTechniquesForTier(
  tier: DifficultyTier,
): readonly TechniqueId[] {
  const maxIdx = DIFFICULTY_TIER_CONFIG[tier].maxTechniqueResolutionOrderIndex;
  return TECHNIQUE_RESOLUTION_ORDER.slice(0, maxIdx + 1);
}

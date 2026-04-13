import type { LevelConfig } from "./board-types";

/**
 * 可配置的关卡递进参数。
 * 默认在「前期表」之后接线性增长：目标分与步数随 levelIndex 递增。
 *
 * ## 得分与「防一击过关」约束（与 match-clear / stabilization 一致）
 *
 * - 三消：`match-clear` 中每格基础分（10）× 本波消除格数；连锁倍率见 `stabilization` 中 `CHAIN_BONUS_PER_EXTRA_WAVE`。
 *   （仅三消与连锁计分，无「两格相邻合并」类单独得分项。）
 * - 连锁：第 n 波得分乘以 `1 + CHAIN_BONUS_PER_EXTRA_WAVE * (n-1)`（默认每多一波 +0.2）。
 * - 移除「对碰合并」额外分后，仅三消链的典型单步稳定化得分明显低于旧版（抽样：单步「最佳合法交换」多在数百量级，
 *   多步累计才是主要得分来源）。前期表目标分因此与「万级」旧档脱钩，改为 **二千～四千档**：
 *   仍远高于任意单步常见上限（非一击过关），并与固定步数下多步累计的可达区间对齐。
 */
export interface LevelProgressionConfig {
  /** levelIndex = 0 时的目标分（用于无「前期表」时的纯线性模式；默认实现优先使用 {@link EARLY_GAME_LEVEL_CONFIG}） */
  baseTargetScore: number;
  /** 每升一级增加的目标分（须 > 0 以保证「下一关目标更高」） */
  targetScorePerLevel: number;
  /** 起始步数 */
  baseMoves: number;
  /** 每升一级增加的步数（可为 0 或正数） */
  movesPerLevel: number;
}

/**
 * 前若干关单独表驱动：目标显著高于「典型单次连锁」分布的中位～高分位，步数略紧于中后期，
 * 避免前期「一手清屏即过关」，同时保留足够容错过关。
 */
export const EARLY_GAME_LEVEL_CONFIG: readonly LevelConfig[] = [
  { levelIndex: 0, targetScore: 200, moves: 22 },
  { levelIndex: 1, targetScore: 400, moves: 24 },
  { levelIndex: 2, targetScore: 600, moves: 26 },
  { levelIndex: 3, targetScore: 800, moves: 28 },
  { levelIndex: 4, targetScore: 1_000, moves: 28 },
  { levelIndex: 5, targetScore: 1_200, moves: 30 },
] as const;

export const DEFAULT_LEVEL_PROGRESSION: LevelProgressionConfig = {
  baseTargetScore: 1_200,
  targetScorePerLevel: 200,
  baseMoves: 30,
  movesPerLevel: 2,
};

/**
 * 由关卡索引与递进配置生成 LevelConfig。
 * - 默认：`EARLY_GAME_LEVEL_CONFIG` 覆盖前 6 关（索引 0～5），之后从第 5 关锚点线性延伸，保证任意 levelIndex+1 的 targetScore 严格大于上一关。
 */
export function getLevelConfigForIndex(
  levelIndex: number,
  progression: LevelProgressionConfig = DEFAULT_LEVEL_PROGRESSION,
): LevelConfig {
  if (!Number.isInteger(levelIndex) || levelIndex < 0) {
    throw new RangeError("levelIndex must be a non-negative integer");
  }
  if (progression.targetScorePerLevel <= 0) {
    throw new RangeError("targetScorePerLevel must be > 0 for strictly increasing targets");
  }

  const early = EARLY_GAME_LEVEL_CONFIG[levelIndex];
  if (early) {
    return { ...early };
  }

  const anchor = EARLY_GAME_LEVEL_CONFIG[EARLY_GAME_LEVEL_CONFIG.length - 1]!;
  const offset = levelIndex - anchor.levelIndex;
  const targetScore = anchor.targetScore + offset * progression.targetScorePerLevel;
  const moves = anchor.moves + offset * progression.movesPerLevel;

  return {
    levelIndex,
    targetScore,
    moves: Math.max(1, moves),
  };
}

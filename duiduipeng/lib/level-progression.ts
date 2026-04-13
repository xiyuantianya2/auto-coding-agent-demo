import type { LevelConfig } from "./board-types";

/**
 * 可配置的关卡递进参数。
 * 默认使用线性公式：目标分与步数随 levelIndex 递增。
 */
export interface LevelProgressionConfig {
  /** levelIndex = 0 时的目标分 */
  baseTargetScore: number;
  /** 每升一级增加的目标分（须 > 0 以保证「下一关目标更高」） */
  targetScorePerLevel: number;
  /** 起始步数 */
  baseMoves: number;
  /** 每升一级增加的步数（可为 0 或正数） */
  movesPerLevel: number;
}

export const DEFAULT_LEVEL_PROGRESSION: LevelProgressionConfig = {
  baseTargetScore: 1200,
  targetScorePerLevel: 400,
  baseMoves: 28,
  movesPerLevel: 2,
};

/**
 * 由关卡索引与递进配置生成 LevelConfig。
 * 当 targetScorePerLevel > 0 时，任意 levelIndex+1 的 targetScore 严格大于上一关。
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

  const targetScore =
    progression.baseTargetScore + levelIndex * progression.targetScorePerLevel;
  const moves =
    progression.baseMoves + levelIndex * progression.movesPerLevel;

  return {
    levelIndex,
    targetScore,
    moves: Math.max(1, moves),
  };
}

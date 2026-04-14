import type { TechniqueId } from "@/lib/solver";
import { TechniqueIds } from "@/lib/solver";
import { techniqueWeight } from "@/lib/solver";

import type { DifficultyTier } from "./difficulty-tier";

/**
 * 单档难度画像：数据驱动，供出题约束与 tier 判定使用。
 *
 * - **allowedTechniques**：该档允许的人类技巧集合；判定「仅用允许技巧能否推进」时以此为过滤条件。
 * - **targetScoreRange**：与 {@link scoreDifficulty} 轨迹总分的闭区间约束（含端点），用于 tier 归类时与盘面分析得分对齐。
 */
export type TierProfileDefinition = {
  tier: DifficultyTier;
  /** 允许使用的技巧 id（与 `@/lib/solver` 登记名一致）。 */
  allowedTechniques: ReadonlySet<TechniqueId>;
  /** 轨迹 `scoreDifficulty(...).score` 的目标区间（闭区间）。 */
  targetScoreRange: readonly [number, number];
};

const ALL_KNOWN: TechniqueId[] = [
  TechniqueIds.UniqueCandidate,
  TechniqueIds.HiddenSingle,
  TechniqueIds.Pointing,
  TechniqueIds.BoxLineReduction,
  TechniqueIds.NakedPair,
  TechniqueIds.HiddenPair,
  TechniqueIds.NakedTriple,
  TechniqueIds.HiddenTriple,
  TechniqueIds.XWing,
];

/**
 * 各档默认画像（可由上层覆盖或扩展，但本模块以该表为基准）。
 *
 * 设计意图（宽松、可完成优先，非极限最优）：
 * - **entry**：裸单 / 隐单；分数偏低。
 * - **normal**：在低阶基础上加入宫内指向与行列摒除。
 * - **hard**：中阶数对/三数组（不含 X-Wing）。
 * - **expert**：全技巧；分数区间最宽。
 */
export const TIER_PROFILES: Readonly<Record<DifficultyTier, TierProfileDefinition>> =
  {
    entry: {
      tier: "entry",
      allowedTechniques: new Set<TechniqueId>([
        TechniqueIds.UniqueCandidate,
        TechniqueIds.HiddenSingle,
      ]),
      /** 低阶-only 轨迹可能步数较多；上界留足余量，档间主要靠允许技巧集合区分。 */
      targetScoreRange: [0, 900],
    },
    normal: {
      tier: "normal",
      allowedTechniques: new Set<TechniqueId>([
        TechniqueIds.UniqueCandidate,
        TechniqueIds.HiddenSingle,
        TechniqueIds.Pointing,
        TechniqueIds.BoxLineReduction,
      ]),
      targetScoreRange: [0, 3500],
    },
    hard: {
      tier: "hard",
      allowedTechniques: new Set<TechniqueId>([
        TechniqueIds.UniqueCandidate,
        TechniqueIds.HiddenSingle,
        TechniqueIds.Pointing,
        TechniqueIds.BoxLineReduction,
        TechniqueIds.NakedPair,
        TechniqueIds.HiddenPair,
        TechniqueIds.NakedTriple,
        TechniqueIds.HiddenTriple,
      ]),
      targetScoreRange: [0, 18_000],
    },
    expert: {
      tier: "expert",
      allowedTechniques: new Set<TechniqueId>(ALL_KNOWN),
      targetScoreRange: [0, 120_000],
    },
  };

export function getTierProfile(tier: DifficultyTier): TierProfileDefinition {
  return TIER_PROFILES[tier];
}

/** 轨迹总分是否落在该档目标分数闭区间内。 */
export function scoreFitsTierProfile(
  score: number,
  tier: DifficultyTier,
): boolean {
  const [lo, hi] = TIER_PROFILES[tier].targetScoreRange;
  return score >= lo && score <= hi;
}

/** 技巧 id 是否被该档允许。 */
export function isTechniqueAllowedForTier(
  technique: TechniqueId,
  tier: DifficultyTier,
): boolean {
  return TIER_PROFILES[tier].allowedTechniques.has(technique);
}

/**
 * 该档允许的**最高**技巧权重上界（用于文档/调试；判定仍以集合为准）。
 * 取 allowed 集合中 `techniqueWeight` 的最大值。
 */
export function maxAllowedTechniqueWeight(tier: DifficultyTier): number {
  let m = 0;
  for (const id of TIER_PROFILES[tier].allowedTechniques) {
    const w = techniqueWeight(id);
    if (w > m) {
      m = w;
    }
  }
  return m;
}

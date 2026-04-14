import type { GameState } from "@/lib/core";

import { TechniqueIds } from "./technique-ids";
import type { SolveStep } from "./types";

/**
 * 各 {@link TechniqueIds} 的默认难度权重（正整数；数值越大表示推理/搜索负担越高）。
 * 未知 `TechniqueId`（第三方题库等）使用 {@link DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT}。
 */
const TECHNIQUE_WEIGHTS: Readonly<Record<string, number>> = {
  [TechniqueIds.UniqueCandidate]: 2,
  [TechniqueIds.HiddenSingle]: 4,
  [TechniqueIds.Pointing]: 6,
  [TechniqueIds.BoxLineReduction]: 6,
  [TechniqueIds.NakedPair]: 10,
  [TechniqueIds.HiddenPair]: 12,
  [TechniqueIds.NakedTriple]: 14,
  [TechniqueIds.HiddenTriple]: 16,
  [TechniqueIds.XWing]: 22,
};

/** 未在 {@link TECHNIQUE_WEIGHTS} 登记的技巧 id 的兜底权重（介于中阶与 X-Wing 之间）。 */
export const DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT = 15;

export function techniqueWeight(technique: string): number {
  const w = TECHNIQUE_WEIGHTS[technique];
  return typeof w === "number" ? w : DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT;
}

export type DifficultyScoreResult = {
  score: number;
  /** 可选展示区间：由本轨迹各步权重的极差推导，见 {@link scoreDifficulty}。 */
  band?: [number, number];
};

/**
 * 将解题轨迹（或 `findApplicableSteps` 的当前可应用步骤列表）映射为难度分数与可选展示区间。
 *
 * - **score**：对 `steps` 中每一步的 `technique` 取 {@link techniqueWeight} 后 **求和**（线性加权）。
 *   `state` 参数保留给未来「结合盘面稀疏度等」的扩展；**当前实现不读取 `state`**，避免与本模块其它路径重复计算。
 * - **band**（可选）：令 `w_i` 为各步权重，`spread = max_i(w_i) - min_i(w_i)`（单步或全同权重时 `spread=0`）。
 *   展示区间取 **`[score - spread, score + spread]`**（下界截断为 `≥ 0`），表示轨迹内部「最难步 − 最易步」带来的离散度，供 UI 显示「约 ±spread」的同量纲区间。
 *
 * 时间复杂度 O(n)，`n = steps.length`；无盘面遍历，适合毫秒级频繁调用。
 */
export function scoreDifficulty(
  _state: GameState,
  steps: SolveStep[],
): DifficultyScoreResult {
  if (steps.length === 0) {
    return { score: 0 };
  }

  const weights: number[] = [];
  let score = 0;
  for (const s of steps) {
    const w = techniqueWeight(s.technique);
    weights.push(w);
    score += w;
  }

  let spread = 0;
  if (weights.length > 1) {
    let minW = weights[0]!;
    let maxW = weights[0]!;
    for (let i = 1; i < weights.length; i++) {
      const w = weights[i]!;
      if (w < minW) minW = w;
      if (w > maxW) maxW = w;
    }
    spread = maxW - minW;
  }

  const low = Math.max(0, score - spread);
  const high = score + spread;
  return { score, band: [low, high] };
}

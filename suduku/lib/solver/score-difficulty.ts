import type { GameState } from "../core";
import { TECHNIQUE_IDS } from "./techniques";
import type { SolveStep } from "./types";

/**
 * 各技法基础分（越大表示技巧越高阶）。与 {@link TECHNIQUE_RESOLUTION_ORDER} 层级一致，
 * 供难度分档与单元测试对照（例如剑鱼权重高于裸单）。
 */
export const TECHNIQUE_WEIGHT: Readonly<Record<string, number>> = {
  [TECHNIQUE_IDS.NAKED_SINGLE]: 12,
  [TECHNIQUE_IDS.HIDDEN_SINGLE]: 18,
  [TECHNIQUE_IDS.NAKED_PAIR]: 45,
  [TECHNIQUE_IDS.HIDDEN_PAIR]: 52,
  [TECHNIQUE_IDS.POINTING]: 58,
  [TECHNIQUE_IDS.CLAIMING]: 58,
  [TECHNIQUE_IDS.X_WING]: 130,
  [TECHNIQUE_IDS.SWORDFISH]: 210,
  [TECHNIQUE_IDS.SKYSCRAPER]: 155,
  [TECHNIQUE_IDS.XY_WING]: 165,
};

const DEFAULT_TECHNIQUE_WEIGHT = 40;

/** 每一步固定开销（反映「多步解题路径」长度）。 */
const PER_STEP_OVERHEAD = 4;

/** 每条被消除的候选数字贡献（与 eliminations 规模挂钩）。 */
const PER_ELIMINATED_CANDIDATE = 1.5;

/** 无 eliminations 时（多为填数步），按 highlights 数量近似「关注候选规模」上限。 */
const PER_HIGHLIGHT = 1;
const MAX_HIGHLIGHT_BONUS = 24;

/**
 * 将技巧序列映射为标量难度分（启发式，可复现）。
 *
 * **公式（透明）**
 *
 * `sum` 初始为 0。对 `steps` 中每一步：
 * - 加上 `TECHNIQUE_WEIGHT[technique]`（未知 id 用 {@link DEFAULT_TECHNIQUE_WEIGHT}）；
 * - 加上 `PER_STEP_OVERHEAD`；
 * - 若有 `eliminations`：对每个 `{ digits }` 加上 `digits.length * PER_ELIMINATED_CANDIDATE`；
 * - 否则：加上 `min(highlights.length * PER_HIGHLIGHT, MAX_HIGHLIGHT_BONUS)`。
 *
 * 返回四舍五入后的整数。
 *
 * `state` 预留供未来纳入空格比例等盘面特征；当前不参与计算，保证对同一 `steps` 分数稳定。
 * 空步骤列表返回 `0`（例如已解空盘无技巧）。
 */
export function scoreDifficulty(state: GameState, steps: SolveStep[]): number {
  void state;
  if (steps.length === 0) return 0;

  let sum = 0;
  for (const step of steps) {
    const base = TECHNIQUE_WEIGHT[step.technique] ?? DEFAULT_TECHNIQUE_WEIGHT;
    sum += base + PER_STEP_OVERHEAD;
    if (step.eliminations?.length) {
      for (const e of step.eliminations) {
        sum += e.digits.length * PER_ELIMINATED_CANDIDATE;
      }
    } else {
      sum += Math.min(step.highlights.length * PER_HIGHLIGHT, MAX_HIGHLIGHT_BONUS);
    }
  }
  return Math.round(sum);
}

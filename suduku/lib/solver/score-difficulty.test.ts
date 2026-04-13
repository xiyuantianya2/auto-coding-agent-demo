import { describe, expect, it } from "vitest";
import { createGameStateFromGivens } from "../core";
import { SOLVED_GRID_SAMPLE } from "../core/fixture";
import { scoreDifficulty, TECHNIQUE_WEIGHT } from "./score-difficulty";
import { TECHNIQUE_IDS } from "./techniques";
import type { SolveStep } from "./types";

describe("scoreDifficulty", () => {
  const state = createGameStateFromGivens(SOLVED_GRID_SAMPLE);

  it("empty steps => 0 (e.g. solved board)", () => {
    expect(scoreDifficulty(state, [])).toBe(0);
  });

  /**
   * 预期：仅含低阶「裸单」的人工步骤，分数落在低区间；含剑鱼 + 多条消除时分数显著更高（单调）。
   * 数值与 `TECHNIQUE_WEIGHT` + 公式绑定，重构权重表时需同步更新本断言。
   */
  it("manual steps: low-only (naked single) < high-tier (swordfish + eliminations)", () => {
    const lowOnly: SolveStep[] = [
      {
        technique: TECHNIQUE_IDS.NAKED_SINGLE,
        highlights: [
          { kind: "cell", ref: { r: 8, c: 8 } },
          { kind: "candidate", ref: { r: 8, c: 8, digit: 8 } },
        ],
      },
    ];
    const withSwordfish: SolveStep[] = [
      {
        technique: TECHNIQUE_IDS.SWORDFISH,
        highlights: [{ kind: "unit", ref: { unit: "row", index: 1 } }],
        eliminations: [
          { r: 0, c: 0, digits: [4, 5, 6] },
          { r: 2, c: 3, digits: [1] },
        ],
      },
    ];
    const sLow = scoreDifficulty(state, lowOnly);
    const sHigh = scoreDifficulty(state, withSwordfish);
    expect(sLow).toBeLessThan(sHigh);
    // 区间预期（裸单约 12+4+min(hl bonus)）
    expect(sLow).toBeGreaterThanOrEqual(15);
    expect(sLow).toBeLessThanOrEqual(80);
    // 剑鱼基础 210 + 步开销 + 消除 (3+1)*1.5
    expect(sHigh).toBeGreaterThanOrEqual(210);
  });

  it("TECHNIQUE_WEIGHT: swordfish base weight exceeds naked single", () => {
    expect(TECHNIQUE_WEIGHT[TECHNIQUE_IDS.SWORDFISH]!).toBeGreaterThan(
      TECHNIQUE_WEIGHT[TECHNIQUE_IDS.NAKED_SINGLE]!,
    );
  });
});

import { describe, expect, it } from "vitest";

import { EMPTY_CELL } from "@/lib/core";
import type { CellState, GameState, Grid9 } from "@/lib/core";

import {
  DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT,
  scoreDifficulty,
  techniqueWeight,
} from "./score-difficulty";
import { TechniqueIds } from "./technique-ids";
import type { SolveStep } from "./types";

function makeEmptyGrid(): Grid9 {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(EMPTY_CELL));
}

function makeEmptyCells(): CellState[][] {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, (): CellState => ({})),
  );
}

function dummyState(): GameState {
  return { grid: makeEmptyGrid(), cells: makeEmptyCells(), mode: "fill" };
}

function step(technique: string): SolveStep {
  return {
    technique,
    highlights: [{ kind: "cell", ref: { r: 0, c: 0 } }],
  };
}

describe("scoreDifficulty", () => {
  it("空步骤：分数为 0，不返回 band", () => {
    const r = scoreDifficulty(dummyState(), []);
    expect(r).toEqual({ score: 0 });
    expect(r.band).toBeUndefined();
  });

  it("单步：分数等于技巧权重；极差为 0 时 band 退化为 [score, score]", () => {
    const s = dummyState();
    const r = scoreDifficulty(s, [step(TechniqueIds.UniqueCandidate)]);
    expect(r.score).toBe(techniqueWeight(TechniqueIds.UniqueCandidate));
    expect(r.band).toEqual([r.score, r.score]);
  });

  it("多步同技巧：分数为步数 × 单步权重（单调递增）", () => {
    const s = dummyState();
    const one = scoreDifficulty(s, [step(TechniqueIds.HiddenSingle)]);
    const three = scoreDifficulty(s, [
      step(TechniqueIds.HiddenSingle),
      step(TechniqueIds.HiddenSingle),
      step(TechniqueIds.HiddenSingle),
    ]);
    expect(three.score).toBe(one.score * 3);
    expect(three.score).toBeGreaterThan(one.score);
    expect(three.band).toEqual([three.score, three.score]);
  });

  it("混合技巧：总分等于加权和；band 由权重极差对称扩展", () => {
    const s = dummyState();
    const uc = techniqueWeight(TechniqueIds.UniqueCandidate);
    const xw = techniqueWeight(TechniqueIds.XWing);
    const r = scoreDifficulty(s, [
      step(TechniqueIds.UniqueCandidate),
      step(TechniqueIds.XWing),
    ]);
    expect(r.score).toBe(uc + xw);
    const spread = xw - uc;
    expect(r.band).toEqual([
      Math.max(0, r.score - spread),
      r.score + spread,
    ]);
  });

  it("未知 TechniqueId：使用默认权重，结果稳定可复现", () => {
    const s = dummyState();
    const id = "custom-technique-from-external-puzzle";
    const a = scoreDifficulty(s, [step(id)]);
    const b = scoreDifficulty(s, [step(id)]);
    expect(a).toEqual(b);
    expect(a.score).toBe(DEFAULT_UNKNOWN_TECHNIQUE_WEIGHT);
  });

  it("相同步骤列表多次调用：输出一致（稳定性）", () => {
    const s = dummyState();
    const steps: SolveStep[] = [
      step(TechniqueIds.NakedPair),
      step(TechniqueIds.Pointing),
      step(TechniqueIds.HiddenTriple),
    ];
    expect(scoreDifficulty(s, steps)).toEqual(scoreDifficulty(s, steps));
  });
});

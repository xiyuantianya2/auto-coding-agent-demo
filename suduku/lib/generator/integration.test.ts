/**
 * 通过 `@/lib/generator` 公共入口串联 RNG、终盘、挖空、唯一解校验与 solver 元数据。
 *
 * **范围说明：**`hard` / `hell` 单次真实生成可能需数分钟（终盘回溯与多轮重试）；完整分档行为在
 * `generator.test.ts`（可控 mock）与 E2E `e2e/puzzle-generator.spec.ts` 中覆盖。本文件对 `easy` /
 * `normal` 做端到端级单元测试与快照回归，并断言 `verifyUniqueSolution` 与 `generatePuzzle` 产出一致。
 */
import { describe, expect, it } from "vitest";

import type { DifficultyTier, Grid9 } from "@/lib/core";
import {
  createMulberry32,
  derivePuzzleSeedString,
  generatePuzzle,
  isValidPuzzleSeedString,
  verifyUniqueSolution,
} from "@/lib/generator";

function gridToLine(g: Grid9): string {
  return g.map((row) => row.map((n) => (n === 0 ? "." : String(n))).join("")).join("");
}

function specToComparable(spec: ReturnType<typeof generatePuzzle>) {
  return {
    seed: spec.seed,
    givensLine: gridToLine(spec.givens),
    difficultyScore: spec.difficultyScore,
    requiredTechniques: spec.requiredTechniques,
  };
}

/** 与 `e2e/puzzle-generator.spec.ts` 一致；在真实管线中可稳定完成 `easy` / `normal`。 */
const STABLE_MULBERRY = 0x9e3779b1;

describe("puzzle-generator barrel (@/lib/generator)", () => {
  it("exports stable RNG + API surface for downstream modules", () => {
    expect(typeof derivePuzzleSeedString).toBe("function");
    expect(typeof generatePuzzle).toBe("function");
    expect(typeof verifyUniqueSolution).toBe("function");
    expect(typeof isValidPuzzleSeedString).toBe("function");
    expect(typeof createMulberry32).toBe("function");
  });

  it("fixed mulberry seed: two generatePuzzle calls yield identical PuzzleSpec (easy + normal)", () => {
    const tiers: DifficultyTier[] = ["easy", "normal"];
    for (const tier of tiers) {
      const rngFactory = () => createMulberry32(STABLE_MULBERRY);
      const a = generatePuzzle({ tier, rng: rngFactory() });
      const b = generatePuzzle({ tier, rng: rngFactory() });
      expect(specToComparable(a)).toEqual(specToComparable(b));
      expect(a.givens).toEqual(b.givens);
    }
  });

  it("verifyUniqueSolution stays consistent with generatePuzzle output (easy + normal)", () => {
    const tiers: DifficultyTier[] = ["easy", "normal"];
    for (const tier of tiers) {
      const spec = generatePuzzle({ tier, rng: createMulberry32(STABLE_MULBERRY) });
      expect(isValidPuzzleSeedString(spec.seed)).toBe(true);
      expect(verifyUniqueSolution(spec.givens)).toBe(true);
    }
  });

  it("matches regression snapshot (easy tier, fixed mulberry seed)", () => {
    const spec = generatePuzzle({ tier: "easy", rng: createMulberry32(STABLE_MULBERRY) });
    expect(specToComparable(spec)).toMatchSnapshot();
  });

  it("single easy-tier generation completes within a light wall-clock budget", () => {
    const t0 = performance.now();
    generatePuzzle({ tier: "easy", rng: createMulberry32(STABLE_MULBERRY) });
    expect(performance.now() - t0).toBeLessThan(30_000);
  });
});

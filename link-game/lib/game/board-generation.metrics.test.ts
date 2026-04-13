import { describe, expect, it } from "vitest";
import {
  generateBoardFromLevel,
  getLastBoardGenerationMetrics,
  maxRandomAttemptsForLevel,
} from "./board-generation";
import { isBoardFullySolvable } from "./full-solvability";
import { DEFAULT_LEVELS } from "./levels";
import { mulberry32 } from "./rng";

/** 冒烟：每关少量固定种子，校验可解性与指标边界（重型统计见 npm run bench:board-gen）。 */
describe("board-generation metrics", () => {
  it(
    "each DEFAULT_LEVELS: solvable board and bounded random attempts",
    () => {
      for (const level of DEFAULT_LEVELS) {
        const cap = maxRandomAttemptsForLevel(level);
        for (let seed = 0; seed < 3; seed++) {
          const rng = mulberry32(seed * 9973 + level.id * 13);
          const board = generateBoardFromLevel(level, rng);
          expect(isBoardFullySolvable(board)).toBe(true);
          const m = getLastBoardGenerationMetrics();
          expect(m?.randomAttempts).toBeGreaterThan(0);
          expect(m?.randomAttempts).toBeLessThanOrEqual(cap);
        }
      }
    },
    120_000,
  );
});

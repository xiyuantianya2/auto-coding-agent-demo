import { describe, expect, it } from "vitest";
import type { LevelConfig } from "./board-types";
import {
  DEFAULT_LEVEL_PROGRESSION,
  EARLY_GAME_LEVEL_CONFIG,
  getLevelConfigForIndex,
  type LevelProgressionConfig,
} from "./level-progression";

describe("getLevelConfigForIndex", () => {
  it("returns rows from EARLY_GAME_LEVEL_CONFIG for covered indices", () => {
    for (const expected of EARLY_GAME_LEVEL_CONFIG) {
      expect(getLevelConfigForIndex(expected.levelIndex, DEFAULT_LEVEL_PROGRESSION)).toEqual({
        ...expected,
      });
    }
  });

  it("raises targetScore by a uniform step between consecutive early-game levels", () => {
    for (let i = 0; i < EARLY_GAME_LEVEL_CONFIG.length - 1; i += 1) {
      const cur = EARLY_GAME_LEVEL_CONFIG[i]!;
      const next = EARLY_GAME_LEVEL_CONFIG[i + 1]!;
      expect(next.targetScore - cur.targetScore).toBe(4_000);
    }
  });

  it("does not decrease moves between consecutive early-game levels", () => {
    for (let i = 0; i < EARLY_GAME_LEVEL_CONFIG.length - 1; i += 1) {
      const cur = EARLY_GAME_LEVEL_CONFIG[i]!;
      const next = EARLY_GAME_LEVEL_CONFIG[i + 1]!;
      expect(next.moves).toBeGreaterThanOrEqual(cur.moves);
    }
  });

  it("strictly increases targetScore for every level step (wide range)", () => {
    const max = 200;
    for (let i = 0; i < max; i += 1) {
      const a = getLevelConfigForIndex(i, DEFAULT_LEVEL_PROGRESSION).targetScore;
      const b = getLevelConfigForIndex(i + 1, DEFAULT_LEVEL_PROGRESSION).targetScore;
      expect(b).toBeGreaterThan(a);
    }
  });

  it("does not decrease moves between any two consecutive levels (wide range)", () => {
    const max = 200;
    for (let i = 0; i < max; i += 1) {
      const a = getLevelConfigForIndex(i, DEFAULT_LEVEL_PROGRESSION).moves;
      const b = getLevelConfigForIndex(i + 1, DEFAULT_LEVEL_PROGRESSION).moves;
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });

  it("after the early table, applies anchor + DEFAULT_LEVEL_PROGRESSION offsets", () => {
    const anchor = EARLY_GAME_LEVEL_CONFIG[EARLY_GAME_LEVEL_CONFIG.length - 1]!;
    for (let levelIndex = EARLY_GAME_LEVEL_CONFIG.length; levelIndex <= 80; levelIndex += 1) {
      const offset = levelIndex - anchor.levelIndex;
      const expected: LevelConfig = {
        levelIndex,
        targetScore: anchor.targetScore + offset * DEFAULT_LEVEL_PROGRESSION.targetScorePerLevel,
        moves: Math.max(1, anchor.moves + offset * DEFAULT_LEVEL_PROGRESSION.movesPerLevel),
      };
      expect(getLevelConfigForIndex(levelIndex, DEFAULT_LEVEL_PROGRESSION)).toEqual(expected);
    }
  });

  it("rejects invalid levelIndex", () => {
    expect(() => getLevelConfigForIndex(-1, DEFAULT_LEVEL_PROGRESSION)).toThrow(RangeError);
    expect(() => getLevelConfigForIndex(1.2, DEFAULT_LEVEL_PROGRESSION)).toThrow(RangeError);
  });

  it("rejects non-positive targetScorePerLevel so targets cannot silently plateau", () => {
    const bad: LevelProgressionConfig = {
      ...DEFAULT_LEVEL_PROGRESSION,
      targetScorePerLevel: 0,
    };
    expect(() => getLevelConfigForIndex(10, bad)).toThrow(RangeError);
  });
});

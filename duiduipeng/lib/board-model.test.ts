import { describe, expect, it } from "vitest";
import { createInitialBoard } from "./create-initial-board";
import { CellSymbol, type Board } from "./board-types";
import { DEFAULT_LEVEL_PROGRESSION, getLevelConfigForIndex } from "./level-progression";

function hasHorizontalOrVerticalTriple(board: Board): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols - 2; c += 1) {
      const a = board[r]![c]!;
      if (a === board[r]![c + 1] && a === board[r]![c + 2]) {
        return true;
      }
    }
  }
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows - 2; r += 1) {
      const a = board[r]![c]!;
      if (a === board[r + 1]![c] && a === board[r + 2]![c]) {
        return true;
      }
    }
  }
  return false;
}

/** 可复现 PRNG（mulberry32），仅用于测试稳定性 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("createInitialBoard", () => {
  it("produces the requested size and only uses known symbols", () => {
    const board = createInitialBoard({ rows: 7, cols: 9 });
    expect(board.length).toBe(7);
    expect(board[0]?.length).toBe(9);
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBeGreaterThanOrEqual(CellSymbol.Ruby);
        expect(cell).toBeLessThanOrEqual(CellSymbol.Amethyst);
      }
    }
  });

  it("has no immediate horizontal or vertical triple", () => {
    const board = createInitialBoard({ rows: 8, cols: 8 });
    expect(hasHorizontalOrVerticalTriple(board)).toBe(false);
  });

  it("is reproducible when random is fixed", () => {
    const a = createInitialBoard({
      rows: 6,
      cols: 6,
      random: mulberry32(42),
    });
    const b = createInitialBoard({
      rows: 6,
      cols: 6,
      random: mulberry32(42),
    });
    expect(a).toEqual(b);
  });
});

describe("getLevelConfigForIndex", () => {
  it("increases target score for each next level", () => {
    const max = 12;
    let prev = getLevelConfigForIndex(0, DEFAULT_LEVEL_PROGRESSION).targetScore;
    for (let i = 1; i <= max; i += 1) {
      const next = getLevelConfigForIndex(i, DEFAULT_LEVEL_PROGRESSION).targetScore;
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it("maps levelIndex into LevelConfig fields", () => {
    const cfg = getLevelConfigForIndex(3, DEFAULT_LEVEL_PROGRESSION);
    expect(cfg.levelIndex).toBe(3);
    expect(cfg.targetScore).toBe(
      DEFAULT_LEVEL_PROGRESSION.baseTargetScore +
        3 * DEFAULT_LEVEL_PROGRESSION.targetScorePerLevel,
    );
    expect(cfg.moves).toBeGreaterThan(0);
  });
});

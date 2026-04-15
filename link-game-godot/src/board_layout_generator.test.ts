import { describe, expect, it } from "vitest";
import { BOARD_COLS, BOARD_ROWS } from "./link_path";
import {
  PATTERN_KIND_COUNT,
  TILES_PER_PATTERN,
  TOTAL_PAIR_COUNT,
  buildPatternMultiset,
  generateSolvableLayout,
  getLastBoardGenerationMetrics,
  mulberry32,
  shuffleInPlace,
} from "./board_layout_generator";
import { isBoardFullySolvable } from "./full_solvability";

function countPatterns(board: ReturnType<typeof generateSolvableLayout>): Map<number, number> {
  const m = new Map<number, number>();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r]![c];
      if (v === null) {
        throw new Error("unexpected empty cell");
      }
      const id = v as number;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  return m;
}

describe("board_layout_generator", () => {
  it("multiset has correct size and per-pattern counts", () => {
    const m = buildPatternMultiset();
    expect(m.length).toBe(BOARD_ROWS * BOARD_COLS);
    const counts = new Map<number, number>();
    for (const id of m) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(PATTERN_KIND_COUNT);
    for (let id = 0; id < PATTERN_KIND_COUNT; id++) {
      expect(counts.get(id)).toBe(TILES_PER_PATTERN);
    }
  });

  it("deterministic seed: same layout for same mulberry32 stream", () => {
    const rng = mulberry32(42_424_242);
    const a = buildPatternMultiset();
    const b = buildPatternMultiset();
    shuffleInPlace(a, rng);
    const rng2 = mulberry32(42_424_242);
    shuffleInPlace(b, rng2);
    expect(a).toEqual(b);
  });

  it("deterministic seed: generateSolvableLayout is stable for fixed seed", () => {
    const board1 = generateSolvableLayout({ rng: mulberry32(777) });
    const board2 = generateSolvableLayout({ rng: mulberry32(777) });
    expect(board1.cells).toEqual(board2.cells);
  });

  it("generated board is full, correct dimensions, and globally solvable", () => {
    const board = generateSolvableLayout({ rng: mulberry32(12345) });
    expect(board.rows).toBe(BOARD_ROWS);
    expect(board.cols).toBe(BOARD_COLS);
    const flat = countPatterns(board);
    expect(flat.size).toBe(PATTERN_KIND_COUNT);
    for (let id = 0; id < PATTERN_KIND_COUNT; id++) {
      expect(flat.get(id)).toBe(TILES_PER_PATTERN);
    }
    expect(TOTAL_PAIR_COUNT).toBe(48);
    expect(isBoardFullySolvable(board)).toBe(true);
  }, 120_000);

  it("multiple sequential generations are solvable (fast probe budget)", () => {
    for (let i = 0; i < 5; i++) {
      const board = generateSolvableLayout({
        rng: mulberry32(10_000 + i),
        maxDfsNodesRandom: 400_000,
        maxDfsNodesVerify: 3_000_000,
      });
      expect(isBoardFullySolvable(board, { maxDfsNodes: 3_000_000 })).toBe(true);
    }
  }, 180_000);

  it("records metrics after generation", () => {
    generateSolvableLayout({ rng: mulberry32(999) });
    const m = getLastBoardGenerationMetrics();
    expect(m).not.toBeNull();
    expect(m!.durationMs).toBeGreaterThanOrEqual(0);
    expect(m!.path === "random" || m!.path === "constructive").toBe(true);
  });
});

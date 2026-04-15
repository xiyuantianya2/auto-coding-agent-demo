import { describe, it, expect } from "vitest";
import { generateSolvableLayout, mulberry32 } from "./board_layout_generator";
import { isBoardFullySolvable } from "./full_solvability";
import { findFirstConnectablePair, reshuffleOccupiedCellsSolvable } from "./hint_shuffle";
import type { BoardGrid } from "./link_path";
import { MATCH_TIME_SECONDS } from "./match_rules";

function countPatternIds(board: BoardGrid): Map<number, number> {
  const m = new Map<number, number>();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.cells[r]?.[c];
      if (v === null || v === undefined) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  return m;
}

describe("task 6 — 计时常量 / 提示 / 洗牌", () => {
  it("单局限时为 120 秒（与 Godot MATCH_TIME_SEC 一致）", () => {
    expect(MATCH_TIME_SECONDS).toBe(120);
  });

  it("可解满盘上提示能找到至少一对可连牌", () => {
    const rng = mulberry32(424242);
    const board = generateSolvableLayout({ rng });
    const p = findFirstConnectablePair(board);
    expect(p).not.toBeNull();
  });

  it("洗牌保持 multiset，且结果盘仍全盘可解（快速路径）", () => {
    const rng = mulberry32(99);
    const board = generateSolvableLayout({ rng });
    const before = countPatternIds(board);
    const ok = reshuffleOccupiedCellsSolvable(board, rng, { maxAttempts: 200 });
    expect(ok).toBe(true);
    expect(countPatternIds(board)).toEqual(before);
    expect(isBoardFullySolvable(board, { maxDfsNodes: 3_000_000 })).toBe(true);
  });
});

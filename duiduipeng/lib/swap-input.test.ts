import { describe, expect, it } from "vitest";
import { CellSymbol, type Board } from "./board-types";
import { createInitialBoard } from "./create-initial-board";
import { BASE_SCORE_PER_CELL } from "./match-clear";
import { mulberry32 } from "./seeded-random";
import { attemptAdjacentSwap, findFirstValidSwap } from "./swap-legality";
import { stabilizeAfterSwap } from "./stabilization";
import {
  createSwapInteractionState,
  reduceSwapInteraction,
  type SwapInteractionState,
} from "./swap-input";

function boardFromLines(lines: CellSymbol[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

/** 单元测试内跑完分步连锁展示，得到与完整播放结束一致的终局态 */
function flushSwapPlayback(s: SwapInteractionState): SwapInteractionState {
  let cur = s;
  while (cur.playback) {
    cur = reduceSwapInteraction(cur, { type: "playback_advance" });
  }
  return cur;
}

/** 与 flushSwapPlayback 应得到相同终局（得分、种子、胜负） */
function finalizeSwapPlayback(s: SwapInteractionState): SwapInteractionState {
  return reduceSwapInteraction(s, { type: "playback_finalize" });
}

describe("swap-input (moves, score, win/fail)", () => {
  it("does not consume a move on rejected swap", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Amber, CellSymbol.Sapphire, CellSymbol.Ruby],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 1,
      levelConfig: { levelIndex: 0, targetScore: 99999, moves: 10 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 1 } });
    expect(s.lastResult?.kind).toBe("rejected");
    expect(s.movesRemaining).toBe(10);
    expect(s.totalScore).toBe(0);
  });

  it("consumes one move and adds score on accepted swap", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: { levelIndex: 0, targetScore: 99999, moves: 10 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 2 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 2 } });
    s = flushSwapPlayback(s);
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.movesRemaining).toBe(9);
    expect(s.totalScore).toBeGreaterThanOrEqual(3 * BASE_SCORE_PER_CELL);
    expect(s.meetsWinTarget).toBe(false);
    expect(s.isFailed).toBe(false);
  });

  it("marks meetsWinTarget when total score reaches target", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: { levelIndex: 0, targetScore: 3 * BASE_SCORE_PER_CELL, moves: 5 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 2 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 2 } });
    s = flushSwapPlayback(s);
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.totalScore).toBeGreaterThanOrEqual(3 * BASE_SCORE_PER_CELL);
    expect(s.meetsWinTarget).toBe(true);
    expect(s.isFailed).toBe(false);
  });

  it("marks failure when moves reach 0 without target", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: { levelIndex: 0, targetScore: 999_999, moves: 1 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 2 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 2 } });
    s = flushSwapPlayback(s);
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.movesRemaining).toBe(0);
    expect(s.meetsWinTarget).toBe(false);
    expect(s.isFailed).toBe(true);
  });

  it("start_level resets board, score, moves and level config", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Emerald, CellSymbol.Ruby, CellSymbol.Amber],
    ]);
    const nextBoard = boardFromLines([
      [CellSymbol.Amethyst, CellSymbol.Amethyst, CellSymbol.Amethyst],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 1,
      levelConfig: { levelIndex: 0, targetScore: 100, moves: 3 },
    });

    s = reduceSwapInteraction(s, {
      type: "start_level",
      board: nextBoard,
      refillSeed: 42,
      levelConfig: { levelIndex: 2, targetScore: 5000, moves: 40 },
    });
    expect(s.board).toBe(nextBoard);
    expect(s.totalScore).toBe(0);
    expect(s.movesRemaining).toBe(40);
    expect(s.levelConfig.levelIndex).toBe(2);
    expect(s.levelConfig.targetScore).toBe(5000);
    expect(s.refillSeed).toBe(42);
    expect(s.meetsWinTarget).toBe(false);
    expect(s.isFailed).toBe(false);
    expect(s.pick.phase).toBe("idle");
  });

  it("ignores cell clicks while stabilization playback is active", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: { levelIndex: 0, targetScore: 99999, moves: 10 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 2 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 2 } });
    expect(s.playback).not.toBeNull();
    const mid = s;
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    expect(s).toBe(mid);
    s = flushSwapPlayback(s);
    expect(s.playback).toBeNull();
    expect(s.turnMatchScore).toBeGreaterThan(0);
  });

  it("playback_finalize matches stepwise playback_advance", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    const level = { levelIndex: 0, targetScore: 99999, moves: 10 };
    let a = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: level,
    });
    a = reduceSwapInteraction(a, { type: "cell_click", cell: { row: 0, col: 2 } });
    a = reduceSwapInteraction(a, { type: "cell_click", cell: { row: 1, col: 2 } });
    expect(a.playback).not.toBeNull();

    let b = createSwapInteractionState(before, {
      refillSeed: 99,
      levelConfig: level,
    });
    b = reduceSwapInteraction(b, { type: "cell_click", cell: { row: 0, col: 2 } });
    b = reduceSwapInteraction(b, { type: "cell_click", cell: { row: 1, col: 2 } });

    const flushed = flushSwapPlayback(a);
    const finalized = finalizeSwapPlayback(b);

    expect(finalized.playback).toBeNull();
    expect(flushed.totalScore).toBe(finalized.totalScore);
    expect(flushed.board).toEqual(finalized.board);
    expect(flushed.refillSeed).toBe(finalized.refillSeed);
    expect(flushed.turnMatchScore).toBe(finalized.turnMatchScore);
    expect(flushed.chainWaves).toBe(finalized.chainWaves);
    expect(flushed.movesRemaining).toBe(finalized.movesRemaining);
    expect(flushed.meetsWinTarget).toBe(finalized.meetsWinTarget);
    expect(flushed.isFailed).toBe(finalized.isFailed);
  });

  it("ignores further swaps after win or loss", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Emerald, CellSymbol.Ruby, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 1,
      levelConfig: { levelIndex: 0, targetScore: 0, moves: 3 },
    });
    expect(s.meetsWinTarget).toBe(true);
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    expect(s.lastResult?.kind).toBe("ignored");
    expect(s.lastResult?.reason).toBe("game_ended");
  });
});

describe("stabilization playback invariants (multi-wave)", () => {
  it("each playback_advance aligns board with step sequence; score stays frozen until finalize", () => {
    let found: {
      readonly beforeSwap: Board;
      readonly a: { row: number; col: number };
      readonly b: { row: number; col: number };
      readonly refillSeed: number;
    } | null = null;

    for (let boardSeed = 0; boardSeed < 2000; boardSeed += 1) {
      const beforeSwap = createInitialBoard({
        rows: 6,
        cols: 6,
        random: mulberry32(boardSeed),
      });
      const pair = findFirstValidSwap(beforeSwap);
      if (!pair) continue;
      const res = attemptAdjacentSwap(beforeSwap, pair[0], pair[1]);
      if (res.kind !== "accepted") continue;
      const refillSeed = 0xace5eed;
      const stab = stabilizeAfterSwap(res.board, { refillSeed });
      if (stab.chainWaves >= 2) {
        found = {
          beforeSwap,
          a: pair[0],
          b: pair[1],
          refillSeed,
        };
        break;
      }
    }

    expect(found).not.toBeNull();
    const { beforeSwap, a, b, refillSeed } = found!;

    const afterAccepted = attemptAdjacentSwap(beforeSwap, a, b);
    expect(afterAccepted.kind).toBe("accepted");
    const afterSwapBoard = afterAccepted.board;
    const stab = stabilizeAfterSwap(afterSwapBoard, { refillSeed });

    const preTotal = 1234;
    let t = createSwapInteractionState(beforeSwap, {
      refillSeed,
      levelConfig: { levelIndex: 0, targetScore: 999_999, moves: 20 },
    });
    t = { ...t, totalScore: preTotal };

    t = reduceSwapInteraction(t, { type: "cell_click", cell: a });
    t = reduceSwapInteraction(t, { type: "cell_click", cell: b });
    expect(t.playback).not.toBeNull();
    expect(t.totalScore).toBe(preTotal);
    expect(t.turnMatchScore).toBe(0);
    expect(t.chainWaves).toBe(0);
    expect(t.board).toEqual(afterSwapBoard);

    const seq = t.playback!.sequence;
    expect(seq.steps.length).toBe(stab.chainWaves);

    let steps = 0;
    while (t.playback) {
      const { completedWaves, sequence: sq } = t.playback;
      const next = completedWaves + 1;
      t = reduceSwapInteraction(t, { type: "playback_advance" });
      if (next < sq.steps.length) {
        expect(t.playback?.completedWaves).toBe(next);
        expect(t.board).toEqual(sq.steps[next - 1]!.boardAfterGravityRefill);
      }
      steps += 1;
      expect(steps).toBeLessThanOrEqual(sq.steps.length + 1);
    }

    expect(t.totalScore).toBe(preTotal + stab.score);
    expect(t.turnMatchScore).toBe(stab.score);
    expect(t.chainWaves).toBe(stab.chainWaves);
    expect(t.board).toEqual(stab.board);
    expect(t.refillSeed).toBe(stab.refillSeedAfter);
  });
});

import { describe, expect, it } from "vitest";
import { CellSymbol, type Board } from "./board-types";
import { BASE_SCORE_PER_CELL } from "./match-clear";
import { MERGE_PAIR_SCORE } from "./stabilization";
import { createSwapInteractionState, reduceSwapInteraction } from "./swap-input";

function boardFromLines(lines: CellSymbol[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

describe("swap-input (task 7: moves & win/fail)", () => {
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
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.movesRemaining).toBe(9);
    expect(s.totalScore).toBeGreaterThanOrEqual(3 * BASE_SCORE_PER_CELL);
    expect(s.meetsWinTarget).toBe(false);
    expect(s.isFailed).toBe(false);
  });

  it("marks meetsWinTarget when total score reaches target", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Sapphire],
      [CellSymbol.Ruby, CellSymbol.Amber, CellSymbol.Emerald],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 101,
      levelConfig: { levelIndex: 0, targetScore: MERGE_PAIR_SCORE, moves: 5 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 0 } });
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.totalScore).toBeGreaterThanOrEqual(MERGE_PAIR_SCORE);
    expect(s.meetsWinTarget).toBe(true);
    expect(s.isFailed).toBe(false);
  });

  it("marks failure when moves reach 0 without target", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Sapphire],
      [CellSymbol.Ruby, CellSymbol.Amber, CellSymbol.Emerald],
    ]);
    let s = createSwapInteractionState(before, {
      refillSeed: 101,
      levelConfig: { levelIndex: 0, targetScore: 999_999, moves: 1 },
    });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 0 } });
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

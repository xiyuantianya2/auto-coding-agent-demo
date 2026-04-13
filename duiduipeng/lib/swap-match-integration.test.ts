import { describe, expect, it } from "vitest";
import { CellSymbol, isEmptyCell, type Board } from "./board-types";
import { BASE_SCORE_PER_CELL } from "./match-clear";
import {
  createSwapInteractionState,
  reduceSwapInteraction,
  type SwapInteractionState,
} from "./swap-input";

function boardFromLines(lines: CellSymbol[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

function flushSwapPlayback(s: SwapInteractionState): SwapInteractionState {
  let cur = s;
  while (cur.playback) {
    cur = reduceSwapInteraction(cur, { type: "playback_advance" });
  }
  return cur;
}

describe("swap + stabilization", () => {
  it("accumulates turn score when a triple is cleared and refills the grid", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Amethyst],
      [CellSymbol.Sapphire, CellSymbol.Emerald, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire, CellSymbol.Amber],
    ]);
    let s = createSwapInteractionState(before, { refillSeed: 99 });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 2 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 2 } });
    s = flushSwapPlayback(s);
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.turnMatchScore).toBe(3 * BASE_SCORE_PER_CELL);
    for (const row of s.board) {
      for (const cell of row) {
        expect(isEmptyCell(cell)).toBe(false);
      }
    }
  });

  it("rejects swap that does not create any line of three", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Sapphire],
      [CellSymbol.Ruby, CellSymbol.Amber, CellSymbol.Emerald],
    ]);
    let s = createSwapInteractionState(before, { refillSeed: 101 });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 0 } });
    expect(s.lastResult?.kind).toBe("rejected");
    expect(s.lastResult?.reason).toBe("no_match");
    expect(s.turnMatchScore).toBe(0);
    expect(s.board).toBe(before);
    for (const row of s.board) {
      for (const cell of row) {
        expect(isEmptyCell(cell)).toBe(false);
      }
    }
  });
});

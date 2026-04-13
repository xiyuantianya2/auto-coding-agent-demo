import { describe, expect, it } from "vitest";
import { CellSymbol, type Board } from "./board-types";
import { createSwapInteractionState, reduceSwapInteraction } from "./swap-input";

function boardFromLines(lines: CellSymbol[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

describe("swap + match clear (task 5)", () => {
  it("accumulates turn score when a triple is cleared", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Emerald, CellSymbol.Ruby],
    ]);
    let s = createSwapInteractionState(before);
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 0 } });
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.turnMatchScore).toBeGreaterThan(0);
    expect(s.board[0]![0]).toBeLessThan(0);
  });

  it("keeps turn score at 0 for merge-only accepted swaps", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Ruby, CellSymbol.Sapphire, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Emerald, CellSymbol.Ruby],
    ]);
    let s = createSwapInteractionState(before);
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 1, col: 0 } });
    expect(s.lastResult?.kind).toBe("accepted");
    expect(s.turnMatchScore).toBe(0);
    expect(s.board[0]![0]).toBe(CellSymbol.Ruby);
  });
});

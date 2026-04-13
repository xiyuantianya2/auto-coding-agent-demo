import { describe, expect, it } from "vitest";
import { CellSymbol, EMPTY_CELL, type Board } from "./board-types";
import {
  attemptAdjacentSwap,
  areOrthogonalAdjacent,
  findFirstValidSwap,
} from "./swap-legality";
import { createSwapInteractionState, reduceSwapInteraction } from "./swap-input";

function boardFromLines(lines: (CellSymbol | typeof EMPTY_CELL)[][]): Board {
  return lines.map((row) => Object.freeze([...row])) as Board;
}

describe("areOrthogonalAdjacent", () => {
  const b = boardFromLines([
    [CellSymbol.Ruby, CellSymbol.Emerald],
    [CellSymbol.Sapphire, CellSymbol.Amber],
  ]);

  it("returns true for edge-adjacent cells", () => {
    expect(areOrthogonalAdjacent(b, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areOrthogonalAdjacent(b, { row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
  });

  it("returns false for diagonal or distant cells", () => {
    expect(areOrthogonalAdjacent(b, { row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(areOrthogonalAdjacent(b, { row: 0, col: 0 }, { row: 0, col: 2 })).toBe(false);
  });
});

describe("attemptAdjacentSwap", () => {
  it("accepts a swap that completes a horizontal triple", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Emerald, CellSymbol.Ruby],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 1, col: 0 });
    expect(r.kind).toBe("accepted");
    expect(r.board).not.toBe(before);
    const row0 = r.board[0]!.map((c) => c);
    expect(row0).toEqual([CellSymbol.Ruby, CellSymbol.Ruby, CellSymbol.Ruby]);
  });

  it("accepts a swap that only forms a merge pair (no line of three)", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Ruby, CellSymbol.Sapphire, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Emerald, CellSymbol.Ruby],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 1, col: 0 });
    expect(r.kind).toBe("accepted");
    const row0 = r.board[0]!.slice(0, 2);
    expect(row0).toEqual([CellSymbol.Ruby, CellSymbol.Ruby]);
  });

  it("rejects a legal orthogonal swap that creates neither triple nor pair at swapped cells", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Amber, CellSymbol.Sapphire, CellSymbol.Ruby],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(r.kind).toBe("rejected");
    expect(r.reason).toBe("no_match_or_merge");
    expect(r.board).toBe(before);
  });

  it("ignores diagonal swaps", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Sapphire],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 1, col: 1 });
    expect(r.kind).toBe("ignored");
    expect(r.reason).toBe("not_orthogonal_adjacent");
    expect(r.board).toBe(before);
  });

  it("rejects swapping two identical symbols (no effective change)", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Emerald, CellSymbol.Sapphire],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(r.kind).toBe("rejected");
    expect(r.reason).toBe("same_symbol_noop");
    expect(r.board).toBe(before);
  });

  it("ignores swaps involving empty cells", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, EMPTY_CELL],
      [CellSymbol.Emerald, CellSymbol.Sapphire],
    ]);
    const r = attemptAdjacentSwap(before, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(r.kind).toBe("ignored");
    expect(r.reason).toBe("empty_cell");
  });
});

describe("findFirstValidSwap", () => {
  it("returns a pair when a horizontal triple can be completed", () => {
    const before = boardFromLines([
      [CellSymbol.Sapphire, CellSymbol.Ruby, CellSymbol.Ruby],
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Emerald],
      [CellSymbol.Emerald, CellSymbol.Emerald, CellSymbol.Ruby],
    ]);
    const pair = findFirstValidSwap(before);
    expect(pair).not.toBeNull();
    expect(attemptAdjacentSwap(before, pair![0], pair![1]).kind).toBe("accepted");
  });

  it("returns null when no adjacent pair can be swapped legally", () => {
    const before = boardFromLines([[CellSymbol.Ruby]]);
    expect(findFirstValidSwap(before)).toBeNull();
  });
});

describe("reduceSwapInteraction", () => {
  it("represents select → swap input and keeps board unchanged on rejected swap", () => {
    const before = boardFromLines([
      [CellSymbol.Ruby, CellSymbol.Emerald, CellSymbol.Sapphire],
      [CellSymbol.Amber, CellSymbol.Sapphire, CellSymbol.Ruby],
    ]);
    let s = createSwapInteractionState(before);
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 0 } });
    expect(s.pick.phase).toBe("first");
    s = reduceSwapInteraction(s, { type: "cell_click", cell: { row: 0, col: 1 } });
    expect(s.lastResult?.kind).toBe("rejected");
    expect(s.board).toBe(before);
  });
});

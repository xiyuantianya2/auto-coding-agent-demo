import { describe, it, expect } from "vitest";
import { findLinkPath, type BoardGrid } from "./link_path";
import { assertPathMeetsLinkRules, isOrthogonalPolyline } from "./path_polyline_rules";

function emptyBoard(): BoardGrid {
  const cells: (number | null)[][] = [];
  for (let r = 0; r < 12; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < 8; c++) {
      row.push(null);
    }
    cells.push(row);
  }
  return { rows: 12, cols: 8, cells };
}

describe("path polyline rules (mirror Godot LinkPathFinder)", () => {
  it("adjacent match has ≤3 segments and ≤2 bends", () => {
    const board = emptyBoard();
    board.cells[0]![0] = 3;
    board.cells[0]![1] = 3;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 1 }, board);
    expect(r.ok).toBe(true);
    assertPathMeetsLinkRules(r);
    expect(isOrthogonalPolyline(r.polyline)).toBe(true);
  });

  it("after clearing two cells, empties participate in a later path", () => {
    const board = emptyBoard();
    board.cells[0]![0] = 1;
    board.cells[0]![1] = 1;
    const first = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 1 }, board);
    expect(first.ok).toBe(true);
    assertPathMeetsLinkRules(first);
    board.cells[0]![0] = null;
    board.cells[0]![1] = null;
    board.cells[0]![2] = 2;
    board.cells[0]![6] = 2;
    const second = findLinkPath({ row: 0, col: 2 }, { row: 0, col: 6 }, board);
    expect(second.ok).toBe(true);
    assertPathMeetsLinkRules(second);
    expect(isOrthogonalPolyline(second.polyline)).toBe(true);
  });
});

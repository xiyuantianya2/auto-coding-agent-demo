import { describe, expect, it } from "vitest";
import {
  BOARD_COLS,
  BOARD_ROWS,
  findLinkPath,
  type BoardGrid,
} from "./link_path";

function emptyBoard(): BoardGrid {
  return {
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    cells: Array.from({ length: BOARD_ROWS }, () =>
      Array<null>(BOARD_COLS).fill(null),
    ),
  };
}

describe("findLinkPath", () => {
  it("rejects same cell", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 1;
    expect(findLinkPath({ row: 0, col: 0 }, { row: 0, col: 0 }, b).ok).toBe(false);
  });

  it("rejects different patterns", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 1;
    b.cells[0]![1] = 2;
    expect(findLinkPath({ row: 0, col: 0 }, { row: 0, col: 1 }, b).ok).toBe(false);
  });

  it("rejects endpoint on empty cell", () => {
    const b = emptyBoard();
    b.cells[0]![1] = 1;
    expect(findLinkPath({ row: 0, col: 0 }, { row: 0, col: 1 }, b).ok).toBe(false);
  });

  it("connects horizontally adjacent same pattern", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 3;
    b.cells[0]![1] = 3;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 1 }, b);
    expect(r.ok).toBe(true);
    expect(r.polyline.length).toBe(2);
    expect(r.bendPoints.length).toBe(0);
  });

  it("connects through cleared cells in a straight line", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 5;
    b.cells[0]![4] = 5;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 4 }, b);
    expect(r.ok).toBe(true);
    expect(r.bendPoints.length).toBe(0);
  });

  it("detours around a blocking tile via outside padding (still ≤2 bends)", () => {
    const b = emptyBoard();
    b.cells[1]![0] = 7;
    b.cells[1]![2] = 7;
    b.cells[1]![1] = 99;
    const r = findLinkPath({ row: 1, col: 0 }, { row: 1, col: 2 }, b);
    expect(r.ok).toBe(true);
    expect(r.bendPoints.length).toBeGreaterThanOrEqual(1);
  });

  it("straight line on empty row has no bend points", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 2;
    b.cells[0]![2] = 2;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 2 }, b);
    expect(r.ok).toBe(true);
    expect(r.bendPoints.length).toBe(0);
  });

  it("forces at least one bend when the straight segment is blocked", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 2;
    b.cells[0]![2] = 2;
    b.cells[0]![1] = 99;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 0, col: 2 }, b);
    expect(r.ok).toBe(true);
    expect(r.bendPoints.length).toBeGreaterThanOrEqual(1);
  });

  it("allows two bends along border corridor", () => {
    const b = emptyBoard();
    b.cells[0]![0] = 4;
    b.cells[2]![2] = 4;
    const r = findLinkPath({ row: 0, col: 0 }, { row: 2, col: 2 }, b);
    expect(r.ok).toBe(true);
    expect(r.bendPoints.length).toBeLessThanOrEqual(2);
  });

  it("polyline endpoints match the two input cells (logical coords)", () => {
    const b = emptyBoard();
    b.cells[3]![3] = 6;
    b.cells[3]![5] = 6;
    const r = findLinkPath({ row: 3, col: 3 }, { row: 3, col: 5 }, b);
    expect(r.ok).toBe(true);
    expect(r.polyline[0]).toEqual({ row: 3, col: 3 });
    expect(r.polyline[r.polyline.length - 1]).toEqual({ row: 3, col: 5 });
  });
});

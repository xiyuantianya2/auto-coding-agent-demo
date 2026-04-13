import { describe, expect, it } from "vitest";
import { createEmptyGrid9 } from "./factory";
import { SAMPLE_GIVENS_MINIMAL } from "./fixture";
import {
  boxIndexFromCell,
  boxPeerPositions,
  boxTopLeftFromCell,
  colPeerPositions,
  isValidPlacement,
  rowPeerPositions,
} from "./placement";

describe("peer index helpers", () => {
  it("boxIndexFromCell matches row-major 3×3 boxes", () => {
    expect(boxIndexFromCell(0, 0)).toBe(0);
    expect(boxIndexFromCell(0, 3)).toBe(1);
    expect(boxIndexFromCell(3, 0)).toBe(3);
    expect(boxIndexFromCell(8, 8)).toBe(8);
  });

  it("boxTopLeftFromCell returns the box origin", () => {
    expect(boxTopLeftFromCell(4, 5)).toEqual({ br: 3, bc: 3 });
  });

  it("rowPeerPositions lists eight coordinates in the same row", () => {
    const peers = rowPeerPositions(4, 4);
    expect(peers).toHaveLength(8);
    expect(peers.every(([r]) => r === 4)).toBe(true);
    expect(peers.some(([r, c]) => r === 4 && c === 4)).toBe(false);
  });

  it("colPeerPositions lists eight coordinates in the same column", () => {
    const peers = colPeerPositions(4, 4);
    expect(peers).toHaveLength(8);
    expect(peers.every(([, c]) => c === 4)).toBe(true);
  });

  it("boxPeerPositions lists eight cells in the same 3×3 box", () => {
    const peers = boxPeerPositions(4, 4);
    expect(peers).toHaveLength(8);
    const { br, bc } = boxTopLeftFromCell(4, 4);
    expect(peers.every(([r, c]) => r >= br && r < br + 3 && c >= bc && c < bc + 3)).toBe(
      true,
    );
  });
});

describe("isValidPlacement", () => {
  const grid = SAMPLE_GIVENS_MINIMAL;

  it("treats empty cells (0) as non-conflicting peers", () => {
    const empty = createEmptyGrid9();
    expect(isValidPlacement(empty, 4, 4, 1)).toBe(true);
    expect(isValidPlacement(grid, 3, 4, 1)).toBe(true);
  });

  it("rejects same-row conflict", () => {
    expect(isValidPlacement(grid, 0, 1, 5)).toBe(false);
  });

  it("rejects same-column conflict", () => {
    expect(isValidPlacement(grid, 1, 0, 5)).toBe(false);
  });

  it("rejects same-box conflict without relying on row/col wording", () => {
    // Box 0 has 7 at (2,2); (1,2) is empty but same box as (2,2).
    expect(isValidPlacement(grid, 1, 2, 7)).toBe(false);
  });

  it("allows a digit when peers are empty or hold other digits only", () => {
    expect(isValidPlacement(grid, 3, 3, 4)).toBe(true);
  });

  it("ignores the digit already at (r,c) when checking replacement", () => {
    expect(isValidPlacement(grid, 0, 0, 5)).toBe(true);
  });

  it("returns false for out-of-range coordinates or digit", () => {
    expect(isValidPlacement(grid, -1, 0, 1)).toBe(false);
    expect(isValidPlacement(grid, 0, 9, 1)).toBe(false);
    expect(isValidPlacement(grid, 0, 0, 0)).toBe(false);
    expect(isValidPlacement(grid, 0, 0, 10)).toBe(false);
  });
});

import { BOARD_SIZE, BOX_SIZE, DIGIT_MAX, DIGIT_MIN, EMPTY_CELL } from "./constants";
import type { Grid9 } from "./types";

/** Box index 0–8 in row-major order over the 3×3 boxes. */
export function boxIndexFromCell(r: number, c: number): number {
  return Math.floor(r / BOX_SIZE) * BOX_SIZE + Math.floor(c / BOX_SIZE);
}

/** Top-left cell of the box that contains `(r, c)`. */
export function boxTopLeftFromCell(r: number, c: number): { br: number; bc: number } {
  return {
    br: Math.floor(r / BOX_SIZE) * BOX_SIZE,
    bc: Math.floor(c / BOX_SIZE) * BOX_SIZE,
  };
}

/**
 * All board coordinates sharing the same row as `(r, c)`, excluding `(r, c)`.
 */
export function rowPeerPositions(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let j = 0; j < BOARD_SIZE; j++) {
    if (j !== c) out.push([r, j]);
  }
  return out;
}

/**
 * All board coordinates sharing the same column as `(r, c)`, excluding `(r, c)`.
 */
export function colPeerPositions(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (i !== r) out.push([i, c]);
  }
  return out;
}

/**
 * Same 3×3 box peers as `(r, c)`, excluding `(r, c)` itself.
 */
export function boxPeerPositions(r: number, c: number): Array<[number, number]> {
  const { br, bc } = boxTopLeftFromCell(r, c);
  const out: Array<[number, number]> = [];
  for (let i = br; i < br + BOX_SIZE; i++) {
    for (let j = bc; j < bc + BOX_SIZE; j++) {
      if (i === r && j === c) continue;
      out.push([i, j]);
    }
  }
  return out;
}

/**
 * Whether placing digit `n` at `(r, c)` violates classic Sudoku against the given
 * **givens / filled digits** grid (`0` = empty). Ignores the current contents of
 * `(r, c)` itself so callers may validate a replacement.
 */
export function isValidPlacement(grid: Grid9, r: number, c: number, n: number): boolean {
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
  if (!Number.isInteger(n) || n < DIGIT_MIN || n > DIGIT_MAX) return false;

  for (let j = 0; j < BOARD_SIZE; j++) {
    if (j === c) continue;
    const v = grid[r][j];
    if (v !== EMPTY_CELL && v === n) return false;
  }

  for (let i = 0; i < BOARD_SIZE; i++) {
    if (i === r) continue;
    const v = grid[i][c];
    if (v !== EMPTY_CELL && v === n) return false;
  }

  const { br, bc } = boxTopLeftFromCell(r, c);
  for (let i = br; i < br + BOX_SIZE; i++) {
    for (let j = bc; j < bc + BOX_SIZE; j++) {
      if (i === r && j === c) continue;
      const v = grid[i][j];
      if (v !== EMPTY_CELL && v === n) return false;
    }
  }

  return true;
}

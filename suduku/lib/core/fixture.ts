import type { Grid9 } from "./types";

/**
 * Sparse givens-only grid for demos and E2E (distinct rows/cols/boxes for the three clues).
 */
export const SAMPLE_GIVENS_MINIMAL: Grid9 = [
  [5, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 6, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 7, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
] as Grid9;

/** Expected `isValidPlacement` outcomes for `SAMPLE_GIVENS_MINIMAL` (home + E2E smoke). */
export const SAMPLE_PLACEMENT_CASES = {
  rowConflict: { r: 0, c: 1, n: 5, valid: false },
  colConflict: { r: 1, c: 0, n: 5, valid: false },
  boxConflict: { r: 1, c: 2, n: 7, valid: false },
  ok: { r: 3, c: 3, n: 4, valid: true },
} as const;

/** A fully filled, classically valid Sudoku grid (for win-state tests). */
export const SOLVED_GRID_SAMPLE: Grid9 = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
] as Grid9;

/**
 * Same as {@link SOLVED_GRID_SAMPLE} but one playable cell `(8,8)` is empty (`0`).
 * The unique completing digit is `8` — one legal `setValue` reaches a winning state.
 */
export const ALMOST_SOLVED_ONE_EMPTY: Grid9 = SOLVED_GRID_SAMPLE.map((row, r) =>
  r === 8 ? row.map((n, c) => (c === 8 ? 0 : n)) : [...row],
) as Grid9;

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

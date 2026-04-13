/**
 * Core types for the link-matching game grid, tiles, and level definitions.
 */

/** Zero-based row/column index on the board grid. */
export interface CellCoord {
  row: number;
  col: number;
}

/** Board size in rows and columns (each cell holds at most one tile). */
export interface GridSize {
  rows: number;
  cols: number;
}

/**
 * Identifies a tile “face” / pattern. Positive integers map to emoji or assets later.
 * `0` is reserved as “no pattern” in some helpers; cleared cells use `null` in the grid.
 */
export type PatternId = number;

/** One playable tile instance (a pair shares the same `patternId`). */
export interface Tile {
  patternId: PatternId;
}

/**
 * Runtime board: `cells[r][c]` is `null` if empty (removed), otherwise the pattern id.
 * Invariant: `cells.length === rows` and each row has length `cols`.
 */
export interface Board extends GridSize {
  cells: (PatternId | null)[][];
}

/**
 * Static level definition: dimensions and how many distinct patterns appear on the board.
 * For a standard layout, `rows * cols` is even and `tileKindCount === (rows * cols) / 2`
 * (each pattern appears exactly twice).
 */
export interface LevelConfig extends GridSize {
  id: number;
  name: string;
  /** Number of distinct tile kinds used in this level (each kind appears in two cells). */
  tileKindCount: number;
}

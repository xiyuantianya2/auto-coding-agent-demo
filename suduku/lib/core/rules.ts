import { BOARD_SIZE, BOX_SIZE, DIGIT_MAX, DIGIT_MIN, EMPTY_CELL } from "./constants";
import { isValidPlacement } from "./placement";
import type { CellState, GameState, Grid9 } from "./types";

/**
 * Compact digit grid derived from {@link GameState}: each cell is `given ?? value ??`
 * {@link EMPTY_CELL}.
 */
export function gridFromGameState(state: GameState): Grid9 {
  const out: number[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: number[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(effectiveDigit(state.cells[r][c]));
    }
    out.push(row);
  }
  return out as Grid9;
}

/** Digit shown in the compact grid: clue wins over player value. */
export function effectiveDigit(cell: CellState): number {
  if (cell.given !== undefined) return cell.given;
  if (cell.value !== undefined) return cell.value;
  return EMPTY_CELL;
}

/** Whether this cell is a fixed puzzle clue (not editable by the player). */
export function isGivenCell(cell: CellState): boolean {
  return cell.given !== undefined;
}

/**
 * Whether the player may change `value` / `notes` at `(r, c)`.
 * Givens are immutable for the session.
 */
export function canModifyCell(state: GameState, r: number, c: number): boolean {
  if (!inBounds(r, c)) return false;
  return !isGivenCell(state.cells[r][c]);
}

/**
 * Model invariants for a single {@link CellState} (fixed rules for this project):
 *
 * - `given` and `value` are never both set.
 * - Digits are `EMPTY_CELL` or in {@link DIGIT_MIN}..{@link DIGIT_MAX}.
 * - If `given` or `value` is set, `notes` must be empty or absent.
 * - `notes` may only contain digits in {@link DIGIT_MIN}..{@link DIGIT_MAX}.
 */
export function cellStateMeetsModelInvariants(cell: CellState): boolean {
  const g = cell.given;
  const v = cell.value;
  if (g !== undefined && v !== undefined) return false;
  if (g !== undefined && !isValidDigit(g)) return false;
  if (v !== undefined && !isValidDigit(v)) return false;

  const notes = cell.notes;
  if (notes !== undefined) {
    if ((g !== undefined || v !== undefined) && notes.size > 0) return false;
    for (const d of notes) {
      if (!isValidDigit(d)) return false;
    }
  }
  return true;
}

function isValidDigit(n: number): boolean {
  return Number.isInteger(n) && n >= DIGIT_MIN && n <= DIGIT_MAX;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/**
 * Whether every cell on the board satisfies {@link cellStateMeetsModelInvariants}.
 */
export function gameStateMeetsModelInvariants(state: GameState): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!cellStateMeetsModelInvariants(state.cells[r][c])) return false;
    }
  }
  return true;
}

/**
 * Clearing the player value at `(r, c)` is allowed when the cell is editable and currently
 * has a `value` (givens cannot be “cleared”).
 */
export function isLegalClearValue(state: GameState, r: number, c: number): boolean {
  if (!canModifyCell(state, r, c)) return false;
  return state.cells[r][c].value !== undefined;
}

/**
 * Setting a digit at `(r, c)` is allowed when the cell is editable, `n` is a proper digit,
 * the board obeys model invariants, and classic Sudoku placement holds against the rest
 * of the grid ({@link isValidPlacement}).
 */
export function isLegalSetValue(state: GameState, r: number, c: number, n: number): boolean {
  if (!canModifyCell(state, r, c)) return false;
  if (!isValidDigit(n)) return false;
  if (!gameStateMeetsModelInvariants(state)) return false;
  const grid = gridFromGameState(state);
  return isValidPlacement(grid, r, c, n);
}

/**
 * Toggling a pencil mark `digit` at `(r, c)` is allowed when the cell is editable, has no
 * `given`/`value`, invariants hold, and `digit` is 1–9.
 *
 * **Business rule:** notes and a player `value` are mutually exclusive; when a `value` is
 * present, use {@link isLegalClearValue} first (UI typically clears notes when setting a value).
 */
export function isLegalToggleNote(
  state: GameState,
  r: number,
  c: number,
  digit: number,
): boolean {
  if (!canModifyCell(state, r, c)) return false;
  if (!isValidDigit(digit)) return false;
  const cell = state.cells[r][c];
  if (cell.given !== undefined || cell.value !== undefined) return false;
  if (!gameStateMeetsModelInvariants(state)) return false;
  return true;
}

/**
 * Every cell has a clue or player digit (compact grid has no {@link EMPTY_CELL}).
 */
export function isBoardComplete(state: GameState): boolean {
  const g = gridFromGameState(state);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (g[r][c] === EMPTY_CELL) return false;
    }
  }
  return true;
}

/**
 * Victory: board is complete and every digit satisfies classic Sudoku against the full grid
 * (equivalent to a valid completed puzzle). Does not verify uniqueness of solution or
 * match to a hidden solution — only rule consistency.
 */
export function isWinningState(state: GameState): boolean {
  if (!gameStateMeetsModelInvariants(state)) return false;
  const grid = gridFromGameState(state);
  if (!isBoardComplete(state)) return false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const n = grid[r][c];
      if (!isValidDigit(n)) return false;
      if (!isValidPlacement(grid, r, c, n)) return false;
    }
  }
  return true;
}

/**
 * **Obvious conflict:** some row, column, or 3×3 box contains the same non-zero digit
 * twice. Cheap duplicate scan for UI warnings; does not detect all logical errors (e.g. a
 * wrong digit with no duplicate yet). Not stored on {@link GameState} — call when needed.
 */
export function hasObviousConflict(state: GameState): boolean {
  return findObviousConflictPositions(state).length > 0;
}

/**
 * Lists coordinates that participate in at least one duplicate in a row, column, or box.
 * Pairs may appear twice (both cells); callers may dedupe for highlighting.
 */
export function findObviousConflictPositions(state: GameState): Array<{ r: number; c: number }> {
  const grid = gridFromGameState(state);
  const seen = new Set<string>();
  const out: Array<{ r: number; c: number }> = [];

  const markDupes = (positions: Array<[number, number]>) => {
    const byDigit = new Map<number, Array<[number, number]>>();
    for (const [r, c] of positions) {
      const n = grid[r][c];
      if (n === EMPTY_CELL) continue;
      let arr = byDigit.get(n);
      if (!arr) {
        arr = [];
        byDigit.set(n, arr);
      }
      arr.push([r, c]);
    }
    for (const coords of byDigit.values()) {
      if (coords.length < 2) continue;
      for (const [r, c] of coords) {
        const key = `${r},${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ r, c });
        }
      }
    }
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Array<[number, number]> = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push([r, c]);
    markDupes(row);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    const col: Array<[number, number]> = [];
    for (let r = 0; r < BOARD_SIZE; r++) col.push([r, c]);
    markDupes(col);
  }
  for (let br = 0; br < BOARD_SIZE; br += BOX_SIZE) {
    for (let bc = 0; bc < BOARD_SIZE; bc += BOX_SIZE) {
      const box: Array<[number, number]> = [];
      for (let i = 0; i < BOX_SIZE; i++) {
        for (let j = 0; j < BOX_SIZE; j++) {
          box.push([br + i, bc + j]);
        }
      }
      markDupes(box);
    }
  }

  return out;
}

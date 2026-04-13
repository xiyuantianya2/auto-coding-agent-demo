import {
  BOARD_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  GAME_STATE_FORMAT_VERSION,
} from "./constants";
import type { CellState, GameArchiveSlice, GameMode, GameState, Grid9 } from "./types";

function assertBoardDimensions(grid: number[][]): asserts grid is Grid9 {
  if (grid.length !== BOARD_SIZE) {
    throw new Error(`Grid9 must have ${BOARD_SIZE} rows, got ${grid.length}`);
  }
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = grid[r];
    if (!row || row.length !== BOARD_SIZE) {
      throw new Error(`Grid9 row ${r} must have length ${BOARD_SIZE}`);
    }
  }
}

function assertDigitOrEmpty(n: number, r: number, c: number): void {
  if (n === EMPTY_CELL) return;
  if (!Number.isInteger(n) || n < DIGIT_MIN || n > DIGIT_MAX) {
    throw new Error(
      `Invalid cell (${r},${c}): expected ${EMPTY_CELL} or ${DIGIT_MIN}–${DIGIT_MAX}, got ${n}`,
    );
  }
}

/** Empty 9×9 grid of {@link EMPTY_CELL} entries. */
export function createEmptyGrid9(): Grid9 {
  const grid: number[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    grid.push(Array.from({ length: BOARD_SIZE }, () => EMPTY_CELL));
  }
  return grid as Grid9;
}

function emptyArchive(): GameArchiveSlice {
  return {
    endlessProgress: {},
    practiceProgress: {},
    tutorialProgress: {},
  };
}

function defaultMode(): GameMode {
  return { kind: "classic" };
}

/** Fresh, empty playable board with classic mode and empty archive. */
export function createEmptyGameState(overrides?: {
  mode?: GameMode;
  archive?: GameArchiveSlice;
}): GameState {
  const cells: CellState[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push({ notes: new Set<number>() });
    }
    cells.push(row);
  }
  return {
    formatVersion: GAME_STATE_FORMAT_VERSION,
    cells,
    mode: overrides?.mode ?? defaultMode(),
    archive: overrides?.archive ?? emptyArchive(),
  };
}

/**
 * Build {@link CellState} rows from a givens-only {@link Grid9}: clue digits become `given`,
 * empty cells get empty `notes` sets. No solving or validity checks beyond dimensions and digits.
 */
export function cellStatesFromGivensGrid(givens: Grid9): CellState[][] {
  assertBoardDimensions(givens);
  const cells: CellState[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const n = givens[r][c];
      assertDigitOrEmpty(n, r, c);
      if (n === EMPTY_CELL) {
        row.push({ notes: new Set<number>() });
      } else {
        row.push({ given: n, notes: new Set<number>() });
      }
    }
    cells.push(row);
  }
  return cells;
}

/**
 * Factory: create an initial {@link GameState} from a puzzle that only specifies givens
 * (0 = empty). Intended for generators, tests, and UI bootstrapping.
 */
export function createGameStateFromGivens(
  givens: Grid9,
  options?: { mode?: GameMode; archive?: GameArchiveSlice; puzzleSeed?: string },
): GameState {
  return {
    formatVersion: GAME_STATE_FORMAT_VERSION,
    cells: cellStatesFromGivensGrid(givens),
    mode: options?.mode ?? defaultMode(),
    archive: options?.archive ?? emptyArchive(),
    puzzleSeed: options?.puzzleSeed,
  };
}

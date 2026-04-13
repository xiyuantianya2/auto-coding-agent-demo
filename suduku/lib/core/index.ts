/**
 * Core Sudoku data model: grid types, cell state, {@link GameState}, and pure factories.
 * Rule helpers (`isValidPlacement`, clone/serialize) are added in later tasks.
 */

export {
  BOARD_SIZE,
  BOX_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  GAME_STATE_FORMAT_VERSION,
} from "./constants";

export type {
  CellState,
  DifficultyTier,
  GameArchiveSlice,
  GameMode,
  GameState,
  Grid9,
} from "./types";

export {
  cellStatesFromGivensGrid,
  createEmptyGameState,
  createEmptyGrid9,
  createGameStateFromGivens,
} from "./factory";

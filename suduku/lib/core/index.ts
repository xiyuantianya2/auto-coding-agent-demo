/**
 * Core Sudoku data model: grid types, cell state, {@link GameState}, pure factories,
 * placement checks, legal-move / win / conflict helpers (`rules`), state cloning,
 * and JSON serialization.
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

export { cloneGameState } from "./clone";

export {
  deserializeGameState,
  GameStateSerializationError,
  serializeGameState,
} from "./serialize";

export {
  boxIndexFromCell,
  boxPeerPositions,
  boxTopLeftFromCell,
  colPeerPositions,
  isValidPlacement,
  rowPeerPositions,
} from "./placement";

export {
  canModifyCell,
  cellStateMeetsModelInvariants,
  effectiveDigit,
  findObviousConflictPositions,
  gameStateMeetsModelInvariants,
  gridFromGameState,
  hasObviousConflict,
  isBoardComplete,
  isGivenCell,
  isLegalClearValue,
  isLegalSetValue,
  isLegalToggleNote,
  isWinningState,
} from "./rules";

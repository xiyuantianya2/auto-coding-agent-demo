export {
  CellSymbol,
  DEFAULT_CELL_SYMBOLS,
  type Board,
  type BoardSize,
  type LevelConfig,
  isCellSymbol,
} from "./board-types";
export {
  type LevelProgressionConfig,
  DEFAULT_LEVEL_PROGRESSION,
  getLevelConfigForIndex,
} from "./level-progression";
export {
  createInitialBoard,
  type CreateInitialBoardOptions,
} from "./create-initial-board";
export type {
  CellPos,
  AdjacentSwapInput,
  SwapPickState,
  AdjacentSwapAttemptResult,
} from "./swap-types";
export {
  areOrthogonalAdjacent,
  attemptAdjacentSwap,
} from "./swap-legality";
export {
  createSwapInteractionState,
  reduceSwapInteraction,
  type SwapInteractionEvent,
  type SwapInteractionState,
} from "./swap-input";

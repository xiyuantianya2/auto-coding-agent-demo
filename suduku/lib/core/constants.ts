/** Side length of the classic 9×9 Sudoku board. */
export const BOARD_SIZE = 9;

/** Side length of a 3×3 box (subgrid). */
export const BOX_SIZE = 3;

/** Minimum digit on the board (inclusive). */
export const DIGIT_MIN = 1;

/** Maximum digit on the board (inclusive). */
export const DIGIT_MAX = 9;

/**
 * Sentinel for an empty cell in a {@link Grid9} matrix.
 * Player and puzzle digits are always in {@link DIGIT_MIN}..{@link DIGIT_MAX}.
 */
export const EMPTY_CELL = 0;

/** Bumped when persisted {@link GameState} shape changes (serialization tasks). */
export const GAME_STATE_FORMAT_VERSION = 1;

/** 标准数独边长（行/列格数）。 */
export const BOARD_SIZE = 9;

/** 宫（box）在行方向的格数。 */
export const BOX_HEIGHT = 3;

/** 宫在列方向的格数。 */
export const BOX_WIDTH = 3;

/** 单元格可填数字下界（含）。 */
export const MIN_DIGIT = 1;

/** 单元格可填数字上界（含）。 */
export const MAX_DIGIT = 9;

/** 盘面总格数（9×9）。 */
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** 与 `GameState.schemaVersion` / 序列化约定对齐的当前契约版本（占位，供后续存档演进）。 */
export const GAME_STATE_SCHEMA_VERSION = 1;

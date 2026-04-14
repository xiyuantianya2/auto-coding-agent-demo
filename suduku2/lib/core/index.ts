/**
 * 核心数据模型与规则（`core-model`）
 *
 * 对外类型与 `module-plan.json` 中本模块 `interface` 字段一致，包括：
 * `Grid9`、`CellState`、`GameState`，以及后续任务将实现的
 * `isValidPlacement`、`cloneGameState`、`serializeGameState`、`deserializeGameState`。
 *
 * 本步（任务 1）仅导出类型、常量与 O(1) 坐标/数字校验；不包含求解、生成与完整规则 API。
 *
 * @see {@link Grid9} {@link CellState} {@link GameState}
 */

export {
  BOX_HEIGHT,
  BOX_WIDTH,
  CELL_COUNT,
  EMPTY_CELL,
  GRID_SIZE,
  isFilledDigit,
  isGridDigit,
  isValidCellCoord,
  isValidColIndex,
  isValidRowIndex,
  MAX_DIGIT,
  MIN_DIGIT,
} from "./constants";

export type { CellState, FillNotesMode, GameState, Grid9 } from "./types";

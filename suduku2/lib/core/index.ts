/**
 * 核心数据模型与规则（`core-model`）
 *
 * 对外类型与 `module-plan.json` 中本模块 `interface` 字段一致，包括：
 * `Grid9`、`CellState`、`GameState`，以及后续任务将实现的
 * `isValidPlacement`、`cloneGameState`、`serializeGameState`、`deserializeGameState`。
 *
 * 任务 2 起导出规则校验与读盘辅助；任务 3 起导出单元格不变式与组合合法落子判定；其余序列化/克隆等见后续任务。
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

export { isCellStateRuleConsistent } from "./cell-invariants";

export {
  isLegalClearCell,
  isLegalFill,
  isLegalToggleNote,
} from "./legal-moves";

export {
  getEffectiveCellDigit,
  getEffectiveDigitAt,
  isValidPlacement,
} from "./placement";

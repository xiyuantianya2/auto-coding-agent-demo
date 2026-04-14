/**
 * **核心数据模型与规则**（`core-model`）的公开入口。
 *
 * 下游模块（`solver-engine`、`server-api`、`notes-logic` 等）应 **仅** 自本文件（例如 `import { … } from "@/lib/core"`）引用类型与函数，
 * 不要从 `lib/core/*.ts` 子路径深引用，以便重构内部文件布局时不破坏对外契约。
 *
 * ## 与 `module-plan.json` 对齐的契约 API
 *
 * - **类型**：{@link Grid9}、{@link CellState}、{@link GameState}（`mode` 为 {@link FillNotesMode}，即 `'fill' | 'notes'`）。
 * - **规则**：{@link isValidPlacement}、读盘辅助 {@link getEffectiveDigitAt} / {@link getEffectiveCellDigit}、组合合法落子
 *   {@link isLegalFill} / {@link isLegalToggleNote} / {@link isLegalClearCell}、不变式 {@link isCellStateRuleConsistent}。
 * - **胜负与冲突**：{@link isBoardFilled}、{@link hasRuleConflict}、{@link isVictory} 等（见下方导出列表）。
 * - **快照与存档**：{@link cloneGameState}、{@link serializeGameState}、{@link deserializeGameState}（版本见 {@link SERIALIZATION_SCHEMA_VERSION}）。
 *
 * ## `grid` 与 `cells` 的约定（摘要）
 *
 * 行优先 9×9：`grid[r][c]`。空格为 `0`（{@link EMPTY_CELL}）。对每格，**生效数字**为 `given ?? value ?? 0`；
 * 不变式要求 `grid[r][c]` 与该生效数字一致。`given` 优先于 `value` 参与规则与显示。详细说明见 {@link GameState} 与 {@link CellState}。
 *
 * ## 序列化 JSON 格式（`serializeGameState` / `deserializeGameState`）
 *
 * 根对象为 UTF-8 JSON，结构为：
 *
 * - `schemaVersion`：`number`，当前为 {@link SERIALIZATION_SCHEMA_VERSION}；不兼容版本由 {@link deserializeGameState} 拒绝。
 * - `mode`：`"fill"` 或 `"notes"`。
 * - `grid`：`number[][]`，9 行 × 9 列，元素为 `0`–`9`。
 * - `cells`：`Array<Array<{ given?: number; value?: number; notes?: number[] }>>`，与 `grid` 同形。
 *   运行时内存中的 `Set<number>` 在 JSON 中表示为 **升序不重复** 的 `notes` 数组（便于跨进程与存档）。
 *
 * 反序列化失败时抛出 {@link DeserializeGameStateError}（非法 JSON、越界、与 `grid` 不一致、`schemaVersion` 不匹配等）。
 *
 * @module @/lib/core
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

export { cloneGameState } from "./clone";

export {
  DeserializeGameStateError,
  deserializeGameState,
  SERIALIZATION_SCHEMA_VERSION,
  serializeGameState,
} from "./serialize";

export {
  findFirstRuleConflictPair,
  hasRuleConflict,
  isBoardFilled,
  isVictory,
  listRuleConflictPairs,
} from "./game-outcome";

export type { RuleConflictPair } from "./game-outcome";

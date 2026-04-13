/**
 * @packageDocumentation
 * 「核心数据模型与规则」模块的**唯一约定公共入口**（路径以项目 `tsconfig` 的 `@/*` 为准，例如 `@/lib/core`）。
 *
 * 子文件仅作实现拆分；包外请由此入口引用公开 API，避免依赖内部路径，以利无循环依赖演进。
 *
 * **与 `module-plan.json` 中本模块 `interface` 字段一致（原文）：**
 *
 * `type Grid9 = number[][]; type CellState = { given?: number; value?: number; notes?: Set<number> }; function isValidPlacement(grid: Grid9, r: number, c: number, n: number): boolean; function cloneGameState(state: GameState): GameState; function serializeGameState(state: GameState): string; function deserializeGameState(json: string): GameState;`
 *
 * 其中 {@link GameState} 的完整结构定义于 `./types`。
 *
 * 另导出本模块实现的其它公开规则与工具（盘面常量、工厂、胜负/合法移动、序列化错误类型等），见下方 re-export。
 */

/** 盘面与尺寸常量（`BOARD_SIZE`、`EMPTY_CELL` 等）。 */
export {
  BOARD_SIZE,
  BOX_SIZE,
  DIGIT_MAX,
  DIGIT_MIN,
  EMPTY_CELL,
  GAME_STATE_FORMAT_VERSION,
} from "./constants";

/**
 * 核心类型：`Grid9`、`CellState`、`GameState` 及模式/存档相关类型（与 module-plan 中 `Grid9` / `CellState` / `GameState` 语义一致）。
 */
export type {
  CellState,
  DifficultyTier,
  GameArchiveSlice,
  GameMode,
  GameState,
  Grid9,
} from "./types";

/** 工厂：空盘面、`GameState` 与从给定数 `Grid9` 初始化。 */
export {
  cellStatesFromGivensGrid,
  createEmptyGameState,
  createEmptyGrid9,
  createGameStateFromGivens,
} from "./factory";

/** `cloneGameState(state)` — module-plan 契约函数。 */
export { cloneGameState } from "./clone";

/** `serializeGameState` / `deserializeGameState` — module-plan 契约函数；非法输入抛 {@link GameStateSerializationError}。 */
export {
  deserializeGameState,
  GameStateSerializationError,
  serializeGameState,
} from "./serialize";

/** `isValidPlacement` — module-plan 契约函数；及行/列/宫 peer 辅助。 */
export {
  boxIndexFromCell,
  boxPeerPositions,
  boxTopLeftFromCell,
  colPeerPositions,
  isValidPlacement,
  rowPeerPositions,
} from "./placement";

/** 合法移动、胜负/完成与明显冲突等公开规则函数。 */
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

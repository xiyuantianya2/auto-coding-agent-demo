export {
  BOARD_SIZE,
  BOX_HEIGHT,
  BOX_WIDTH,
  CELL_COUNT,
  GAME_STATE_SCHEMA_VERSION,
  MAX_DIGIT,
  MIN_DIGIT,
} from "./constants";

export type {
  CellState,
  DifficultyTier,
  GameMode,
  GameState,
  Grid9,
  InputMode,
} from "./types";

import type { GameState, Grid9 } from "./types";

/**
 * 检查在 `(r,c)` 放置数字 `n` 是否与同行、同列、同宫已有非零数字冲突。
 * @throws 尚未实现（见 core-model task 2）。
 */
export function isValidPlacement(
  grid: Grid9,
  r: number,
  c: number,
  n: number,
): boolean {
  void grid;
  void r;
  void c;
  void n;
  throw new Error(
    "core-model: isValidPlacement is not implemented yet (task 2).",
  );
}

/**
 * 深拷贝 `GameState`（含每格 `notes` 的 `Set`）。
 * @throws 尚未实现（见 core-model task 5）。
 */
export function cloneGameState(state: GameState): GameState {
  void state;
  throw new Error(
    "core-model: cloneGameState is not implemented yet (task 5).",
  );
}

/**
 * 将 `GameState` 序列化为 JSON 字符串（`Set` 转为可 JSON 结构）。
 * @throws 尚未实现（见 core-model task 6）。
 */
export function serializeGameState(state: GameState): string {
  void state;
  throw new Error(
    "core-model: serializeGameState is not implemented yet (task 6).",
  );
}

/**
 * 从 JSON 字符串恢复 `GameState`。
 * @throws 尚未实现（见 core-model task 6）。
 */
export function deserializeGameState(json: string): GameState {
  void json;
  throw new Error(
    "core-model: deserializeGameState is not implemented yet (task 6).",
  );
}

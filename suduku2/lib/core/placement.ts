import {
  BOX_HEIGHT,
  BOX_WIDTH,
  EMPTY_CELL,
  GRID_SIZE,
  MAX_DIGIT,
  MIN_DIGIT,
  isFilledDigit,
  isValidCellCoord,
} from "./constants";
import type { CellState, GameState } from "./types";

/**
 * 从单元格状态读取「当前生效」的确定数字：{@link CellState.given} 优先于 {@link CellState.value}；
 * 二者皆无或非法时返回 {@link EMPTY_CELL}（`0`）。
 */
export function getEffectiveCellDigit(cell: CellState): number {
  const g = cell.given;
  if (g !== undefined && isFilledDigit(g)) {
    return g;
  }
  const v = cell.value;
  if (v !== undefined && isFilledDigit(v)) {
    return v;
  }
  return EMPTY_CELL;
}

/**
 * 读取坐标 `(r,c)` 处单元格的生效数字，语义与 {@link GameState.grid} 中该格应保持一致（在不变式成立时）。
 */
export function getEffectiveDigitAt(state: GameState, r: number, c: number): number {
  if (!isValidCellCoord(r, c)) {
    return EMPTY_CELL;
  }
  return getEffectiveCellDigit(state.cells[r][c]);
}

/**
 * 在标准 9×9 规则下，判断若将 `1`–`9` 的数字 `n` 置于 `(r,c)`，是否与**其他格**的生效数字在同行、同列或同宫冲突。
 *
 * - 坐标或 `n` 不合法时返回 `false`。
 * - 不检查给定格是否可改、笔记互斥等单元格不变式（由后续任务覆盖）。
 */
export function isValidPlacement(
  state: GameState,
  r: number,
  c: number,
  n: number,
): boolean {
  if (!isValidCellCoord(r, c) || !isFilledDigit(n)) {
    return false;
  }

  for (let cc = 0; cc < GRID_SIZE; cc++) {
    if (cc === c) {
      continue;
    }
    if (getEffectiveDigitAt(state, r, cc) === n) {
      return false;
    }
  }

  for (let rr = 0; rr < GRID_SIZE; rr++) {
    if (rr === r) {
      continue;
    }
    if (getEffectiveDigitAt(state, rr, c) === n) {
      return false;
    }
  }

  const boxRow = Math.floor(r / BOX_HEIGHT) * BOX_HEIGHT;
  const boxCol = Math.floor(c / BOX_WIDTH) * BOX_WIDTH;
  for (let i = 0; i < BOX_HEIGHT; i++) {
    for (let j = 0; j < BOX_WIDTH; j++) {
      const rr = boxRow + i;
      const cc = boxCol + j;
      if (rr === r && cc === c) {
        continue;
      }
      if (getEffectiveDigitAt(state, rr, cc) === n) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 若 `(r,c)` 为空格且恰好有一个数字 `1`–`9` 满足 {@link isValidPlacement}，则返回该数字；否则返回 `null`
 *（含 0 个或多个合法填数、坐标非法、或该格已有生效数字的情形）。
 *
 * 至多 9 次 {@link isValidPlacement} 调用，无深度搜索。
 */
export function getUniqueValidPlacementDigit(
  state: GameState,
  r: number,
  c: number,
): number | null {
  if (!isValidCellCoord(r, c) || getEffectiveDigitAt(state, r, c) !== EMPTY_CELL) {
    return null;
  }
  let found: number | null = null;
  let count = 0;
  for (let n = MIN_DIGIT; n <= MAX_DIGIT; n++) {
    if (!isValidPlacement(state, r, c, n)) {
      continue;
    }
    count++;
    found = n;
    if (count > 1) {
      return null;
    }
  }
  return count === 1 ? found : null;
}

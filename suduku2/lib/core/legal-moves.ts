import { EMPTY_CELL, isFilledDigit, isValidCellCoord } from "./constants";
import { getEffectiveDigitAt, isValidPlacement } from "./placement";
import { isCellStateRuleConsistent } from "./cell-invariants";
import type { GameState } from "./types";

function hasGiven(state: GameState, r: number, c: number): boolean {
  const g = state.cells[r][c].given;
  return g !== undefined && isFilledDigit(g);
}

/**
 * 在「当前盘面」下，玩家填入确定数字 `n` 是否合法：非给定格、坐标与数字范围、`fill` 模式、
 * {@link isValidPlacement}、且当前单元格满足规则不变式。
 *
 * 不模拟落子后的新状态；仅判定意图是否允许。
 */
export function isLegalFill(state: GameState, r: number, c: number, n: number): boolean {
  if (!isValidCellCoord(r, c) || !isFilledDigit(n) || state.mode !== "fill") {
    return false;
  }
  const cell = state.cells[r][c];
  if (!isCellStateRuleConsistent(cell)) {
    return false;
  }
  if (hasGiven(state, r, c)) {
    return false;
  }
  return isValidPlacement(state, r, c, n);
}

/**
 * 切换 `(r,c)` 处铅笔笔记中的数字 `n`（有则去、无则加）是否合法：非给定格、空生效格、
 * `notes` 模式、数字范围、当前单元格满足不变式。
 *
 * 与填数互斥：若该格已有生效玩家填数或给定数，则不允许编辑笔记。
 */
export function isLegalToggleNote(
  state: GameState,
  r: number,
  c: number,
  n: number,
): boolean {
  if (!isValidCellCoord(r, c) || !isFilledDigit(n) || state.mode !== "notes") {
    return false;
  }
  const cell = state.cells[r][c];
  if (!isCellStateRuleConsistent(cell)) {
    return false;
  }
  if (hasGiven(state, r, c)) {
    return false;
  }
  if (getEffectiveDigitAt(state, r, c) !== EMPTY_CELL) {
    return false;
  }
  return true;
}

/**
 * 清除非给定格的玩家填数与笔记是否合法。给定格不可清除。
 *
 * 对已空且无笔记的格子再次清除视为合法（幂等）。
 */
export function isLegalClearCell(state: GameState, r: number, c: number): boolean {
  if (!isValidCellCoord(r, c)) {
    return false;
  }
  const cell = state.cells[r][c];
  if (!isCellStateRuleConsistent(cell)) {
    return false;
  }
  if (hasGiven(state, r, c)) {
    return false;
  }
  return true;
}

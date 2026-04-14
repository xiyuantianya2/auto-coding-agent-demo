import { BOX_HEIGHT, BOX_WIDTH, CELL_COUNT, EMPTY_CELL, GRID_SIZE } from "./constants";
import { getEffectiveDigitAt } from "./placement";
import type { GameState } from "./types";

/**
 * 两个不同格子在同行、同列或同宫内，且生效数字相同，即构成一对规则冲突。
 */
export interface RuleConflictPair {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  /** 冲突的重复数字（1–9）。 */
  digit: number;
}

function sameSudokuUnit(r1: number, c1: number, r2: number, c2: number): boolean {
  if (r1 === r2) {
    return true;
  }
  if (c1 === c2) {
    return true;
  }
  const br1 = Math.floor(r1 / BOX_HEIGHT);
  const bc1 = Math.floor(c1 / BOX_WIDTH);
  const br2 = Math.floor(r2 / BOX_HEIGHT);
  const bc2 = Math.floor(c2 / BOX_WIDTH);
  return br1 === br2 && bc1 === bc2;
}

/**
 * 当且仅当 9×9 每一格都存在生效确定数字（1–9）时视为填满。
 * 仅有铅笔笔记、无 `given`/`value` 的格仍为空格。
 */
export function isBoardFilled(state: GameState): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (getEffectiveDigitAt(state, r, c) === EMPTY_CELL) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 是否存在至少一对格子违反数独唯一性（同行/同列/同宫出现重复的非零数字）。
 */
export function hasRuleConflict(state: GameState): boolean {
  return findFirstRuleConflictPair(state) !== null;
}

/**
 * 按行优先扁平下标顺序，返回第一对冲突格；无冲突时返回 `null`。
 */
export function findFirstRuleConflictPair(state: GameState): RuleConflictPair | null {
  for (let i = 0; i < CELL_COUNT; i++) {
    const r1 = Math.floor(i / GRID_SIZE);
    const c1 = i % GRID_SIZE;
    const d1 = getEffectiveDigitAt(state, r1, c1);
    if (d1 === EMPTY_CELL) {
      continue;
    }
    for (let j = i + 1; j < CELL_COUNT; j++) {
      const r2 = Math.floor(j / GRID_SIZE);
      const c2 = j % GRID_SIZE;
      const d2 = getEffectiveDigitAt(state, r2, c2);
      if (d1 !== d2) {
        continue;
      }
      if (sameSudokuUnit(r1, c1, r2, c2)) {
        return { r1, c1, r2, c2, digit: d1 };
      }
    }
  }
  return null;
}

/**
 * 列出所有冲突的无序格对（每对至多出现一次；顺序为行优先 `i < j`）。
 * 便于调试或批量高亮；典型盘面规模下规模很小。
 */
export function listRuleConflictPairs(state: GameState): RuleConflictPair[] {
  const out: RuleConflictPair[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const r1 = Math.floor(i / GRID_SIZE);
    const c1 = i % GRID_SIZE;
    const d1 = getEffectiveDigitAt(state, r1, c1);
    if (d1 === EMPTY_CELL) {
      continue;
    }
    for (let j = i + 1; j < CELL_COUNT; j++) {
      const r2 = Math.floor(j / GRID_SIZE);
      const c2 = j % GRID_SIZE;
      const d2 = getEffectiveDigitAt(state, r2, c2);
      if (d1 !== d2) {
        continue;
      }
      if (sameSudokuUnit(r1, c1, r2, c2)) {
        out.push({ r1, c1, r2, c2, digit: d1 });
      }
    }
  }
  return out;
}

/**
 * 胜利：全盘已填满且无任何规则冲突（与 {@link GameState} 中生效数字约定一致）。
 */
export function isVictory(state: GameState): boolean {
  return isBoardFilled(state) && !hasRuleConflict(state);
}

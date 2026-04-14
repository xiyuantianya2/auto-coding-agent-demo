/** 标准数独行/列格数（9×9）。与 `module-plan.json` 中 `Grid9` 一致。 */
export const GRID_SIZE = 9;

/** 宫（box）在行方向的格数。 */
export const BOX_HEIGHT = 3;

/** 宫在列方向的格数。 */
export const BOX_WIDTH = 3;

/** 盘面总格数（9×9）。 */
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/** 单元格可填数字下界（含）。 */
export const MIN_DIGIT = 1;

/** 单元格可填数字上界（含）。 */
export const MAX_DIGIT = 9;

/**
 * 盘面空格在 `Grid9` 中的数值表示。
 * 规则层与存档序列化均以 `0` 表示「无数字」。
 */
export const EMPTY_CELL = 0;

/**
 * 行索引是否在 `[0, GRID_SIZE)` 内。
 */
export function isValidRowIndex(r: number): boolean {
  return Number.isInteger(r) && r >= 0 && r < GRID_SIZE;
}

/**
 * 列索引是否在 `[0, GRID_SIZE)` 内。
 */
export function isValidColIndex(c: number): boolean {
  return Number.isInteger(c) && c >= 0 && c < GRID_SIZE;
}

/**
 * 坐标 `(r,c)` 是否落在 9×9 盘面内。
 */
export function isValidCellCoord(r: number, c: number): boolean {
  return isValidRowIndex(r) && isValidColIndex(c);
}

/**
 * `n` 是否为合法填数（1–9），不含空格 `0`。
 */
export function isFilledDigit(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_DIGIT && n <= MAX_DIGIT;
}

/**
 * `n` 是否为合法盘面数字：`0`（空）或 `1`–`9`。
 */
export function isGridDigit(n: number): boolean {
  return n === EMPTY_CELL || isFilledDigit(n);
}

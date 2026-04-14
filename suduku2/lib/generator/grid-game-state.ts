import {
  EMPTY_CELL,
  GRID_SIZE,
  type CellState,
  type GameState,
  type Grid9,
} from "@/lib/core";

/**
 * 深拷贝 9×9 盘面，避免与调用方共享行/列数组引用。
 */
export function cloneGrid9(grid: Grid9): Grid9 {
  return grid.map((row) => row.slice());
}

/**
 * 从「仅含给定数字」的 {@link Grid9} 构造 {@link GameState}：非零格写入 `given`，零格为空。
 *
 * - 会**复制**输入 `givens` 到新的 `grid`/`cells`，不保留对原数组或其行的引用。
 * - `mode` 固定为 `"fill"`。
 */
export function gameStateFromGivensGrid(givens: Grid9): GameState {
  const grid: Grid9 = Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => {
      const v = givens[r]?.[c];
      return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 9 ? v : EMPTY_CELL;
    }),
  );

  const cells: CellState[][] = Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => {
      const v = grid[r][c];
      if (v === EMPTY_CELL) {
        return {};
      }
      return { given: v };
    }),
  );

  return { grid, cells, mode: "fill" };
}

/**
 * 将**完整填好**（每格 1–9）的 {@link Grid9} 转为 {@link GameState}：数字写入 `value`（非 `given`），便于与题面给定格区分。
 *
 * - 会复制输入；`mode` 为 `"fill"`。
 * - 若存在非 1–9 或空格，抛出 {@link Error}。
 */
export function gameStateFromSolvedGrid(solution: Grid9): GameState {
  const grid: Grid9 = Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => {
      const v = solution[r]?.[c];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9) {
        throw new Error(
          `gameStateFromSolvedGrid: expected digits 1–9 at (${r},${c}), got ${String(v)}`,
        );
      }
      return v;
    }),
  );

  const cells: CellState[][] = Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => ({
      value: grid[r][c],
    })),
  );

  return { grid, cells, mode: "fill" };
}

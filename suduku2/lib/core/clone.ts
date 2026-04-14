import type { CellState, GameState, Grid9 } from "./types";

function cloneGrid9(grid: Grid9): Grid9 {
  return grid.map((row) => row.slice());
}

function cloneCellState(cell: CellState): CellState {
  const next: CellState = {};
  if (cell.given !== undefined) next.given = cell.given;
  if (cell.value !== undefined) next.value = cell.value;
  if (cell.notes !== undefined) next.notes = new Set(cell.notes);
  return next;
}

function cloneCells(cells: CellState[][]): CellState[][] {
  return cells.map((row) => row.map((cell) => cloneCellState(cell)));
}

/**
 * 深拷贝 {@link GameState}：`grid` 与 `cells` 为嵌套数组副本；
 * `CellState.notes` 存在时为新的 `Set`，不与原状态共享引用。
 */
export function cloneGameState(state: GameState): GameState {
  return {
    grid: cloneGrid9(state.grid),
    cells: cloneCells(state.cells),
    mode: state.mode,
  };
}

import { generateBoardFromLevel } from "./board-generation";
import { canConnect } from "./connectivity";
import type { Board, CellCoord, LevelConfig } from "./types";

/** 一局游戏的客户端状态：棋盘、当前选中格、是否胜利。 */
export interface PlayState {
  readonly level: LevelConfig;
  readonly board: Board;
  readonly selected: CellCoord | null;
  readonly won: boolean;
}

function isValidCoord(board: Board, coord: CellCoord): boolean {
  return (
    coord.row >= 0 &&
    coord.row < board.rows &&
    coord.col >= 0 &&
    coord.col < board.cols
  );
}

function cloneBoard(board: Board): Board {
  return {
    rows: board.rows,
    cols: board.cols,
    cells: board.cells.map((row) => [...row]),
  };
}

function clearPair(board: Board, a: CellCoord, b: CellCoord): Board {
  const next = cloneBoard(board);
  next.cells[a.row]![a.col] = null;
  next.cells[b.row]![b.col] = null;
  return next;
}

export function isBoardCleared(board: Board): boolean {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (board.cells[r]![c] !== null) return false;
    }
  }
  return true;
}

export function createInitialPlayState(
  level: LevelConfig,
  rng: () => number = Math.random,
): PlayState {
  return {
    level,
    board: generateBoardFromLevel(level, rng),
    selected: null,
    won: false,
  };
}

/** 用当前关卡配置重新生成棋盘（重新开始本关）。 */
export function restartPlayState(
  state: PlayState,
  rng: () => number = Math.random,
): PlayState {
  return createInitialPlayState(state.level, rng);
}

/**
 * 点击一格：空位忽略；无选中则选中；点同一格取消；
 * 第二次若同图案且可连则消除并判定胜利；否则第二次格子成为新的选中（重选）。
 */
export function handleCellClick(state: PlayState, coord: CellCoord): PlayState {
  if (state.won) return state;
  if (!isValidCoord(state.board, coord)) return state;

  const pattern = state.board.cells[coord.row]![coord.col];
  if (pattern === null) return state;

  const { selected, board } = state;

  if (selected === null) {
    return { ...state, selected: coord };
  }

  if (selected.row === coord.row && selected.col === coord.col) {
    return { ...state, selected: null };
  }

  const first = board.cells[selected.row]![selected.col];
  if (
    first !== null &&
    first === pattern &&
    canConnect(selected, coord, board)
  ) {
    const nextBoard = clearPair(board, selected, coord);
    return {
      ...state,
      board: nextBoard,
      selected: null,
      won: isBoardCleared(nextBoard),
    };
  }

  return { ...state, selected: coord };
}

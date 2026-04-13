import {
  type Board,
  type CellSymbol,
  DEFAULT_CELL_SYMBOLS,
} from "./board-types";

export interface CreateInitialBoardOptions {
  readonly rows: number;
  readonly cols: number;
  /** 参与填充的符号集合，默认五种 */
  readonly symbols?: readonly CellSymbol[];
  /**
   * 返回 [0, 1) 的随机数，默认 Math.random。
   * 传入可复现的 PRNG 可得到稳定棋盘（用于测试/回放）。
   */
  readonly random?: () => number;
}

function defaultRandom(): number {
  return Math.random();
}

function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
}

/**
 * 在已放置格子的前提下，列出在 (row,col) 放置时不会立刻形成横向或竖向三连的符号。
 */
function validSymbolsForCell(
  grid: (CellSymbol | null)[][],
  row: number,
  col: number,
  kinds: readonly CellSymbol[],
): CellSymbol[] {
  const left1 = col > 0 ? grid[row]![col - 1]! : null;
  const left2 = col > 1 ? grid[row]![col - 2]! : null;
  const up1 = row > 0 ? grid[row - 1]![col]! : null;
  const up2 = row > 1 ? grid[row - 2]![col]! : null;

  const blocked = new Set<CellSymbol>();
  if (left1 !== null && left2 !== null && left1 === left2) {
    blocked.add(left1);
  }
  if (up1 !== null && up2 !== null && up1 === up2) {
    blocked.add(up1);
  }

  return kinds.filter((k) => !blocked.has(k));
}

/**
 * 生成矩形棋盘，格子为给定符号集合中的值。
 * 使用回溯填充，避免初始局面出现横向或竖向连续三个相同符号（与常见三消开局一致）。
 */
export function createInitialBoard(options: CreateInitialBoardOptions): Board {
  const rows = options.rows;
  const cols = options.cols;
  const kinds = options.symbols ?? DEFAULT_CELL_SYMBOLS;
  const random = options.random ?? defaultRandom;

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new RangeError("rows and cols must be positive integers");
  }
  if (kinds.length < 1) {
    throw new RangeError("symbols must be non-empty");
  }

  const grid: (CellSymbol | null)[][] = Array.from({ length: rows }, () =>
    Array<CellSymbol | null>(cols).fill(null),
  );

  const dfs = (row: number, col: number): boolean => {
    if (row === rows) {
      return true;
    }
    const nextCol = col + 1;
    const nextRow = nextCol === cols ? row + 1 : row;
    const nextColWrapped = nextCol === cols ? 0 : nextCol;

    const candidates = validSymbolsForCell(grid, row, col, [...kinds]);
    if (candidates.length === 0) {
      return false;
    }
    shuffleInPlace(candidates, random);

    for (const symbol of candidates) {
      grid[row]![col] = symbol;
      if (dfs(nextRow, nextColWrapped)) {
        return true;
      }
      grid[row]![col] = null;
    }
    return false;
  };

  const ok = dfs(0, 0);
  if (!ok) {
    throw new Error(
      "createInitialBoard: could not fill grid without triples; try more symbol kinds or larger board",
    );
  }

  return grid.map((r) => Object.freeze([...r])) as Board;
}

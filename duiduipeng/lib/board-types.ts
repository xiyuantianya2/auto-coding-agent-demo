/**
 * 棋盘单元格上的符号类型（对对碰 / 三消图块）。
 * 数值仅用于区分种类，具体渲染由 UI 层决定。
 */
export enum CellSymbol {
  Ruby = 0,
  Emerald = 1,
  Sapphire = 2,
  Amber = 3,
  Amethyst = 4,
}

/** 默认可用的全部符号（顺序稳定，便于测试与可复现随机池） */
export const DEFAULT_CELL_SYMBOLS: readonly CellSymbol[] = [
  CellSymbol.Ruby,
  CellSymbol.Emerald,
  CellSymbol.Sapphire,
  CellSymbol.Amber,
  CellSymbol.Amethyst,
] as const;

/** 行优先：第一维行、第二维列 */
export type Board = readonly (readonly CellSymbol[])[];

export interface BoardSize {
  readonly rows: number;
  readonly cols: number;
}

/** 关卡参数：关卡索引、目标分数、步数上限 */
export interface LevelConfig {
  /** 从 0 开始的关卡索引 */
  levelIndex: number;
  targetScore: number;
  /** 本关允许的最多步数（步数上限） */
  moves: number;
}

export function isCellSymbol(value: number): value is CellSymbol {
  return Number.isInteger(value) && value >= 0 && value < DEFAULT_CELL_SYMBOLS.length;
}

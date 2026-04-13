/** 棋盘格子坐标（列、行），原点在左上 */
export type CellCoord = { col: number; row: number };

/** 单个格子的图案；0 表示空 */
export type TileId = number;

/** 行优先的一维棋盘，长度为 rows * cols */
export type Board = {
  cols: number;
  rows: number;
  /** 与 [row][col] 展平一致：index = row * cols + col */
  cells: TileId[];
};

/** 关卡静态配置（生成棋盘前） */
export type LevelConfig = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** 不同图案种类数；总格数须为偶数且能由成对棋子铺满 */
  pairKinds: number;
};

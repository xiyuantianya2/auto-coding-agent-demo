import { isBoardFullySolvable } from "./full-solvability";
import type { Board, LevelConfig, PatternId } from "./types";

/**
 * 可解性重试策略（稳定、可预期）：
 * - 多重集合固定：每种图案恰好出现两次，与关卡格数一致。
 * - 在固定上限 `MAX_SHUFFLE_ATTEMPTS` 内反复 Fisher–Yates 洗牌并铺盘；
 *   每次铺好后用 `isBoardFullySolvable`（全盘 DFS 回溯）判定是否存在完整消除序列；
 *   仅当为 true 时返回棋盘；若始终无法在随机洗牌下命中可解布局则抛错，避免静默返回死局。
 */
const MAX_SHUFFLE_ATTEMPTS = 5000;

function assertValidLevel(level: LevelConfig): void {
  const { rows, cols, tileKindCount } = level;
  if (rows <= 0 || cols <= 0) {
    throw new Error("Level rows/cols must be positive.");
  }
  const cells = rows * cols;
  if (cells % 2 !== 0) {
    throw new Error("Level cell count must be even.");
  }
  if (tileKindCount * 2 !== cells) {
    throw new Error(
      `tileKindCount (${tileKindCount}) must equal (rows*cols)/2 (${cells / 2}).`,
    );
  }
}

/** In-place Fisher–Yates shuffle; `rng` should return uniform values in [0, 1). */
export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j]!;
    arr[j] = t!;
  }
}

function buildCellsFromFlat(
  rows: number,
  cols: number,
  flat: PatternId[],
): (PatternId | null)[][] {
  if (flat.length !== rows * cols) {
    throw new Error("flat pattern list length does not match grid size.");
  }
  const cells: (PatternId | null)[][] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const row: (PatternId | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(flat[k++]!);
    }
    cells.push(row);
  }
  return cells;
}

/**
 * 由关卡配置生成棋盘：成对图案、随机洗牌铺盘；若随机布局下非全盘可解则重洗，直至上限。
 */
export function generateBoardFromLevel(
  level: LevelConfig,
  rng: () => number = Math.random,
): Board {
  assertValidLevel(level);
  const { rows, cols, tileKindCount } = level;

  const multiset: PatternId[] = [];
  for (let id = 1; id <= tileKindCount; id++) {
    multiset.push(id, id);
  }

  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    shuffleInPlace(multiset, rng);
    const cells = buildCellsFromFlat(rows, cols, multiset);
    const board: Board = { rows, cols, cells };
    if (isBoardFullySolvable(board)) {
      return board;
    }
  }

  throw new Error(
    `generateBoardFromLevel: could not generate a fully solvable layout within ${MAX_SHUFFLE_ATTEMPTS} shuffles (level id=${level.id}).`,
  );
}

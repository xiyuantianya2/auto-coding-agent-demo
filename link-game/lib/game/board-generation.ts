import { isBoardFullySolvable } from "./full-solvability";
import type { Board, LevelConfig, PatternId } from "./types";

/**
 * 生成策略（分层终止保障，优先级从高到低）：
 *
 * 1. **随机可解**：在关卡相关上限内 Fisher–Yates 洗牌并铺盘，每次用 `isBoardFullySolvable` 校验；
 *    大棋盘单次 DFS 成本高，故对最重关卡使用更紧的随机上限，避免主线程长时间阻塞。
 * 2. **构造式铺盘（备用）**：若随机未命中，则使用行主序「相邻对」模板 `1,1,2,2,…,k,k` 铺盘。
 *    该模板对当前 `DEFAULT_LEVELS` 三关均已验证为全盘可解；若未来关卡配置变更导致模板不可解，
 *    会在备用路径末尾校验失败并抛错（而非静默返回死局）。
 *
 * 成本记录见 `BoardGenerationMetrics` / `getLastBoardGenerationMetrics`。
 */

/** 每关随机阶段上限（命中即返回；否则走构造备用）。关卡越大，单次可解性判定越重，上限越小。 */
export function maxRandomAttemptsForLevel(level: LevelConfig): number {
  switch (level.id) {
    case 1:
      return 2500;
    case 2:
      return 150;
    case 3:
      return 50;
    default:
      return 500;
  }
}

/**
 * 对**已生成**棋盘做二次全盘可解校验时使用的 DFS 节点上限（与构造备用路径末尾校验一致）。
 * 开发自检 `board-selftest` 亦用此上界，避免无预算 DFS 在异常盘面上耗时过长。
 */
export function maxDfsNodesForOutputVerification(level: LevelConfig): number {
  return level.id === 1 ? 6_000_000 : level.id === 2 ? 4_000_000 : 3_000_000;
}

/**
 * 随机洗牌探测时使用的 DFS 节点预算（避免在「不可解」随机布局上指数级爆搜）；构造备用路径末尾用 `maxDfsNodesForOutputVerification` 做完整度校验。
 * 已导出供 `board-selftest` 等对生成结果做「与生成器相同标准」的快速复验。
 */
export function maxDfsNodesForRandomProbe(level: LevelConfig): number {
  switch (level.id) {
    case 1:
      return 4_000_000;
    case 2:
      return 450_000;
    case 3:
      return 320_000;
    default:
      return 400_000;
  }
}

/** 最近一次 `generateBoardFromLevel` 的耗时与路径（供测试与调试）。 */
export interface BoardGenerationMetrics {
  /** 随机阶段实际洗牌次数（构造成功时为尝试次数；走备用路径时为上限值）。 */
  readonly randomAttempts: number;
  readonly path: "random" | "constructive";
  /** 本次生成总耗时（毫秒）。 */
  readonly durationMs: number;
}

let lastBoardGenerationMetrics: BoardGenerationMetrics | null = null;

export function getLastBoardGenerationMetrics(): BoardGenerationMetrics | null {
  return lastBoardGenerationMetrics;
}

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

/** 行主序相邻对铺盘（构造备用路径）； multiset 顺序为 1,1,2,2,… */
function buildConstructiveStripeBoard(level: LevelConfig): Board {
  assertValidLevel(level);
  const { rows, cols, tileKindCount } = level;
  const flat: PatternId[] = [];
  for (let id = 1; id <= tileKindCount; id++) {
    flat.push(id, id);
  }
  const cells = buildCellsFromFlat(rows, cols, flat);
  return { rows, cols, cells };
}

/**
 * 由关卡配置生成棋盘：优先随机可解布局；若随机阶段未命中则使用构造式铺盘（仍校验全盘可解）。
 */
export function generateBoardFromLevel(
  level: LevelConfig,
  rng: () => number = Math.random,
): Board {
  assertValidLevel(level);
  const { rows, cols, tileKindCount } = level;
  const t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

  const multiset: PatternId[] = [];
  for (let id = 1; id <= tileKindCount; id++) {
    multiset.push(id, id);
  }

  const maxRandom = maxRandomAttemptsForLevel(level);

  for (let attempt = 0; attempt < maxRandom; attempt++) {
    shuffleInPlace(multiset, rng);
    const cells = buildCellsFromFlat(rows, cols, multiset);
    const board: Board = { rows, cols, cells };
    if (
      isBoardFullySolvable(board, {
        maxDfsNodes: maxDfsNodesForRandomProbe(level),
      })
    ) {
      const t1 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      lastBoardGenerationMetrics = {
        randomAttempts: attempt + 1,
        path: "random",
        durationMs: t1 - t0,
      };
      return board;
    }
  }

  const fallback = buildConstructiveStripeBoard(level);
  const verifyBudget = maxDfsNodesForOutputVerification(level);
  if (!isBoardFullySolvable(fallback, { maxDfsNodes: verifyBudget })) {
    throw new Error(
      `generateBoardFromLevel: constructive stripe layout is not fully solvable within verify budget (level id=${level.id}); adjust LevelConfig or fallback strategy.`,
    );
  }
  const t1 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  lastBoardGenerationMetrics = {
    randomAttempts: maxRandom,
    path: "constructive",
    durationMs: t1 - t0,
  };
  return fallback;
}

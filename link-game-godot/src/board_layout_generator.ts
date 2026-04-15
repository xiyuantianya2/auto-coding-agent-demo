/**
 * 8×12 可解随机布局：约 8 种图案，每种 12 枚（6 对），共 48 对 / 96 格。
 * 策略：Fisher–Yates 洗牌 + `isBoardFullySolvable` 探测；失败则重试；仍失败则用确定性行主序块铺盘并校验。
 */

import { isBoardFullySolvable } from "./full_solvability";
import type { BoardGrid } from "./link_path";
import { BOARD_COLS, BOARD_ROWS } from "./link_path";

/** 图案种类数（每种 12 枚 = 6 对） */
export const PATTERN_KIND_COUNT = 8;

export const TILES_PER_PATTERN = (BOARD_ROWS * BOARD_COLS) / PATTERN_KIND_COUNT;

/** 总对子数 */
export const TOTAL_PAIR_COUNT = (BOARD_ROWS * BOARD_COLS) / 2;

export interface BoardGenerationMetrics {
  readonly randomAttempts: number;
  readonly path: "random" | "constructive";
  readonly durationMs: number;
}

let lastMetrics: BoardGenerationMetrics | null = null;

export function getLastBoardGenerationMetrics(): BoardGenerationMetrics | null {
  return lastMetrics;
}

/** Fisher–Yates；`rng` 返回 [0,1) */
export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j]!;
    arr[j] = t!;
  }
}

function buildCellsFromFlat(flat: number[]): number[][] {
  if (flat.length !== BOARD_ROWS * BOARD_COLS) {
    throw new Error("flat length mismatch");
  }
  const cells: number[][] = [];
  let k = 0;
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push(flat[k++]!);
    }
    cells.push(row);
  }
  return cells;
}

function boardFromFlat(flat: number[]): BoardGrid {
  return {
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    cells: buildCellsFromFlat(flat),
  };
}

/** 构造 multiset：每种图案 id 各 `TILES_PER_PATTERN` 枚 */
export function buildPatternMultiset(): number[] {
  const flat: number[] = [];
  for (let id = 0; id < PATTERN_KIND_COUNT; id++) {
    for (let n = 0; n < TILES_PER_PATTERN; n++) {
      flat.push(id);
    }
  }
  return flat;
}

/** 行主序块铺盘（确定性备用）：先铺完所有 0，再铺所有 1，… */
function buildConstructiveFlat(): number[] {
  return buildPatternMultiset();
}

/** Mulberry32 — 与测试确定性种子对齐 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_MAX_RANDOM_ATTEMPTS = 250;
const DEFAULT_MAX_DFS_RANDOM = 400_000;
const DEFAULT_MAX_DFS_VERIFY = 3_000_000;
const DEFAULT_MAX_ELAPSED_MS = 5_000;

export interface GenerateLayoutOptions {
  readonly rng?: () => number;
  readonly maxRandomAttempts?: number;
  readonly maxDfsNodesRandom?: number;
  readonly maxDfsNodesVerify?: number;
  readonly maxElapsedMs?: number;
}

/**
 * 生成可解完整棋盘（全部 96 格有牌）。
 */
export function generateSolvableLayout(options?: GenerateLayoutOptions): BoardGrid {
  const rng = options?.rng ?? Math.random;
  const maxRandom = options?.maxRandomAttempts ?? DEFAULT_MAX_RANDOM_ATTEMPTS;
  const maxDfsRandom = options?.maxDfsNodesRandom ?? DEFAULT_MAX_DFS_RANDOM;
  const maxDfsVerify = options?.maxDfsNodesVerify ?? DEFAULT_MAX_DFS_VERIFY;
  const maxElapsed = options?.maxElapsedMs ?? DEFAULT_MAX_ELAPSED_MS;

  const now = () =>
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const t0 = now();

  const multiset = buildPatternMultiset();

  for (let attempt = 0; attempt < maxRandom; attempt++) {
    if (now() - t0 > maxElapsed) {
      break;
    }
    shuffleInPlace(multiset, rng);
    const board = boardFromFlat(multiset);
    if (isBoardFullySolvable(board, { maxDfsNodes: maxDfsRandom })) {
      const t1 = now();
      lastMetrics = { randomAttempts: attempt + 1, path: "random", durationMs: t1 - t0 };
      return board;
    }
  }

  const fallbackFlat = buildConstructiveFlat();
  const fallback = boardFromFlat(fallbackFlat);
  if (!isBoardFullySolvable(fallback, { maxDfsNodes: maxDfsVerify })) {
    throw new Error(
      "generateSolvableLayout: constructive layout failed full solvability check; adjust template or budgets.",
    );
  }
  const t1 = now();
  lastMetrics = { randomAttempts: maxRandom, path: "constructive", durationMs: t1 - t0 };
  return fallback;
}

/**
 * 稳定化管线：仅三消——反复「检测 ≥3 同色连线 → 消除置空 → 重力 → 补位」直至无三消。
 *
 * ## 重力与补位
 *
 * - 重力：每列非空块下落至底部，中间不留空（row 0 为顶部，row 增大为向下）。
 * - 补位：空位自每列**自上而下**依次用符号池中的随机符号填充；随机序由调用方提供的 `random()` 决定，便于传入 `mulberry32(seed)` 复现。
 */

import {
  type CellSymbol,
  DEFAULT_CELL_SYMBOLS,
  EMPTY_CELL,
  type Board,
  isEmptyCell,
} from "./board-types";
import { BASE_SCORE_PER_CELL, findAllMatchPositions } from "./match-clear";
import { mulberry32 } from "./seeded-random";

/**
 * 连锁加成：第 1 波倍率 1；第 n 波（n≥2）在该波基础分上乘以 `1 + CHAIN_BONUS_PER_EXTRA_WAVE * (n - 1)`。
 * 例如 0.2 表示第 2 波 ×1.2、第 3 波 ×1.4。
 */
export const CHAIN_BONUS_PER_EXTRA_WAVE = 0.2;

function parseKey(key: string): readonly [number, number] {
  const [rs, cs] = key.split(",").map(Number) as [number, number];
  return [rs, cs];
}

function cloneBoardMutable(board: Board): number[][] {
  return board.map((row) => [...row]);
}

function freezeBoard(grid: number[][]): Board {
  return grid.map((row) => Object.freeze([...row])) as Board;
}

/**
 * 检测全盘三消匹配，将匹配格置空并计算本步基础分（无连锁倍率）。
 * 无匹配时返回原棋盘引用，得分 0。
 */
export function applyTripleClear(board: Board): {
  readonly board: Board;
  readonly score: number;
  readonly tripleClearedCells: number;
} {
  const tripleKeys = findAllMatchPositions(board);
  if (tripleKeys.size === 0) {
    return {
      board,
      score: 0,
      tripleClearedCells: 0,
    };
  }

  const next = cloneBoardMutable(board);
  for (const key of tripleKeys) {
    const [r, c] = parseKey(key);
    next[r]![c] = EMPTY_CELL;
  }

  const frozen = freezeBoard(next);
  const tripleClearedCells = tripleKeys.size;
  return {
    board: frozen,
    score: tripleClearedCells * BASE_SCORE_PER_CELL,
    tripleClearedCells,
  };
}

export interface GravityRefillOptions {
  /** 参与补位的符号池，默认五种基础符号 */
  readonly symbols?: readonly CellSymbol[];
  /** 返回 [0,1) 的随机数，例如 mulberry32(seed) */
  readonly random: () => number;
}

/**
 * 列重力下落并在顶部空位补符号（单次扫描即可完成「填满」）。
 */
export function applyGravityAndRefill(board: Board, options: GravityRefillOptions): Board {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const pool = options.symbols ?? DEFAULT_CELL_SYMBOLS;
  const rnd = options.random;
  const next = cloneBoardMutable(board);

  for (let c = 0; c < cols; c += 1) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r -= 1) {
      const v = next[r]![c]!;
      if (!isEmptyCell(v)) {
        next[write]![c] = v;
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r -= 1) {
      const pick = Math.floor(rnd() * pool.length);
      next[r]![c] = pool[pick]!;
    }
  }

  return freezeBoard(next);
}

export function boardHasEmpty(board: Board): boolean {
  for (const row of board) {
    for (const v of row) {
      if (isEmptyCell(v)) {
        return true;
      }
    }
  }
  return false;
}

export interface StabilizeAfterSwapOptions {
  /** 补位随机种子；与 `mulberry32(seed)` 配合可复现 */
  readonly refillSeed: number;
  readonly symbols?: readonly CellSymbol[];
  /**
   * 连锁波次加成系数，默认 {@link CHAIN_BONUS_PER_EXTRA_WAVE}。
   * 第 n 波得分 = 该波基础分 × (1 + ratio × (n - 1))。
   */
  readonly chainBonusPerExtraWave?: number;
}

const MAX_STABILIZE_ITERATIONS = 512;

/**
 * 交换接受后的完整稳定化：反复「三消检测 → 消除 → 重力补位」直至无三消，
 * 累计本步总分（含连锁加成），并推进补位随机种子以便下一手可复现。
 */
export function stabilizeAfterSwap(board: Board, options: StabilizeAfterSwapOptions): {
  readonly board: Board;
  /** 本步所有连锁波次得分合计（含连锁加成） */
  readonly score: number;
  readonly chainWaves: number;
  readonly tripleClearedCells: number;
  /** 本步全部重力补位结束后，供下一手使用的补位种子 */
  readonly refillSeedAfter: number;
} {
  const symbols = options.symbols;
  const ratio = options.chainBonusPerExtraWave ?? CHAIN_BONUS_PER_EXTRA_WAVE;
  let b = board;
  let workingSeed = options.refillSeed >>> 0;
  let totalScore = 0;
  let totalTriples = 0;
  let waves = 0;

  for (let iter = 0; iter < MAX_STABILIZE_ITERATIONS; iter += 1) {
    const cleared = applyTripleClear(b);
    if (cleared.tripleClearedCells === 0) {
      b = cleared.board;
      break;
    }
    waves += 1;
    totalTriples += cleared.tripleClearedCells;
    const mult = 1 + ratio * (waves - 1);
    totalScore += Math.round(cleared.score * mult);
    b = cleared.board;
    const rnd = mulberry32(workingSeed);
    b = applyGravityAndRefill(b, { random: rnd, symbols });
    workingSeed = (workingSeed + 0x9e37_79b9) >>> 0;
  }

  return {
    board: b,
    score: totalScore,
    chainWaves: waves,
    tripleClearedCells: totalTriples,
    refillSeedAfter: workingSeed,
  };
}

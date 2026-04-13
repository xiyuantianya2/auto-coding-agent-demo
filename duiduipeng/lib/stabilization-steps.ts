/**
 * 与 UI 无关的稳定化「动画步骤」序列：按连锁波次拆分「检测三消 → 消除置空 → 重力补位」，
 * 供播放端按序驱动盘面；与 {@link stabilizeAfterSwap} 一次性结算在相同种子下终局与累计分一致。
 */

import type { Board } from "./board-types";
import type { AdjacentSwapAttemptResult, CellPos } from "./swap-types";
import { findAllMatchPositions } from "./match-clear";
import { mulberry32 } from "./seeded-random";
import {
  CHAIN_BONUS_PER_EXTRA_WAVE,
  applyGravityAndRefill,
  applyTripleClear,
  type StabilizeAfterSwapOptions,
} from "./stabilization";

const MAX_STABILIZE_ITERATIONS = 512;

function keysToSortedPositions(keys: ReadonlySet<string>): readonly CellPos[] {
  const arr: CellPos[] = [];
  for (const key of keys) {
    const [r, c] = key.split(",").map(Number) as [number, number];
    arr.push({ row: r, col: c });
  }
  arr.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
  return arr;
}

/**
 * 单波连锁：一批待消除格、消除后盘面、本波重力补位后盘面、本波得分增量（已含连锁倍率）。
 */
export interface StabilizationChainWaveStep {
  /** 从 1 开始的连锁波次（第 1 波无额外倍率加成项） */
  readonly waveIndex: number;
  /** 本批待消除格坐标（与 `findAllMatchPositions` 一致，行优先排序） */
  readonly clearedPositions: readonly CellPos[];
  readonly clearedCellCount: number;
  /** 消除三消格之后、尚未重力补位的盘面（空位为 EMPTY_CELL） */
  readonly boardAfterClear: Board;
  /** 本波基础分（未乘连锁倍率）：`clearedCellCount * BASE_SCORE_PER_CELL` */
  readonly baseScore: number;
  /** 本波使用的连锁倍率：`1 + CHAIN_BONUS_PER_EXTRA_WAVE * (waveIndex - 1)` */
  readonly chainMultiplier: number;
  /** 本波计入总分的增量：`round(baseScore * chainMultiplier)` */
  readonly scoreDelta: number;
  /**
   * 执行本波重力与补位时所使用的补位种子（与 {@link stabilizeAfterSwap} 中
   * `mulberry32(workingSeed)` 一致；每波结束后工作种子仍会按固定常量推进）。
   */
  readonly refillSeedBeforeGravityRefill: number;
  /** 本波重力与补位结束后的完整盘面，并作为下一波检测的起点 */
  readonly boardAfterGravityRefill: Board;
}

export interface StabilizationStepSequence {
  /** 每一波连锁对应一步；空数组表示交换后已无三消（盘面不变） */
  readonly steps: readonly StabilizationChainWaveStep[];
  /** 与 {@link stabilizeAfterSwap} 的 `score` 一致 */
  readonly totalScore: number;
  readonly chainWaves: number;
  /** 所有波次消除的格子总数（与 `stabilizeAfterSwap` 的 `tripleClearedCells` 一致） */
  readonly tripleClearedCells: number;
  readonly finalBoard: Board;
  /** 与 `stabilizeAfterSwap` 的 `refillSeedAfter` 一致 */
  readonly refillSeedAfter: number;
}

/**
 * 从「交换已接受」后的盘面构建完整稳定化步骤序列（输入与 {@link stabilizeAfterSwap} 相同）。
 */
export function buildStabilizationStepSequence(
  boardAfterAcceptedSwap: Board,
  options: StabilizeAfterSwapOptions,
): StabilizationStepSequence {
  const symbols = options.symbols;
  const ratio = options.chainBonusPerExtraWave ?? CHAIN_BONUS_PER_EXTRA_WAVE;
  let b = boardAfterAcceptedSwap;
  let workingSeed = options.refillSeed >>> 0;
  let totalScore = 0;
  let totalTriples = 0;
  let waves = 0;
  const stepList: StabilizationChainWaveStep[] = [];

  for (let iter = 0; iter < MAX_STABILIZE_ITERATIONS; iter += 1) {
    const keysBeforeClear = findAllMatchPositions(b);
    const cleared = applyTripleClear(b);
    if (cleared.tripleClearedCells === 0) {
      b = cleared.board;
      break;
    }

    const clearedPositions = keysToSortedPositions(keysBeforeClear);
    waves += 1;
    const mult = 1 + ratio * (waves - 1);
    const scoreDelta = Math.round(cleared.score * mult);
    totalTriples += cleared.tripleClearedCells;
    totalScore += scoreDelta;

    const seedForThisRefill = workingSeed;
    const rnd = mulberry32(workingSeed);
    const afterRefill = applyGravityAndRefill(cleared.board, { random: rnd, symbols });
    workingSeed = (workingSeed + 0x9e37_79b9) >>> 0;

    stepList.push({
      waveIndex: waves,
      clearedPositions,
      clearedCellCount: cleared.tripleClearedCells,
      boardAfterClear: cleared.board,
      baseScore: cleared.score,
      chainMultiplier: mult,
      scoreDelta,
      refillSeedBeforeGravityRefill: seedForThisRefill,
      boardAfterGravityRefill: afterRefill,
    });

    b = afterRefill;
  }

  return {
    steps: stepList,
    totalScore,
    chainWaves: waves,
    tripleClearedCells: totalTriples,
    finalBoard: b,
    refillSeedAfter: workingSeed,
  };
}

/**
 * 若交换结果为 `accepted`，则返回与 {@link buildStabilizationStepSequence} 相同结构的步骤序列；
 * 否则返回 `null`（无稳定化动画）。
 */
export function buildStabilizationStepSequenceFromAcceptedSwap(
  swapResult: AdjacentSwapAttemptResult,
  options: StabilizeAfterSwapOptions,
): StabilizationStepSequence | null {
  if (swapResult.kind !== "accepted") {
    return null;
  }
  return buildStabilizationStepSequence(swapResult.board, options);
}

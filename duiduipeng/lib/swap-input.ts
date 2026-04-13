import type { Board, LevelConfig } from "./board-types";
import type { AdjacentSwapAttemptResult, CellPos, SwapPickState } from "./swap-types";
import { getLevelConfigForIndex } from "./level-progression";
import { attemptAdjacentSwap } from "./swap-legality";
import { stabilizeAfterSwap } from "./stabilization";
import {
  buildStabilizationStepSequence,
  type StabilizationStepSequence,
} from "./stabilization-steps";

/**
 * 表示「选格 → 与第二格尝试相邻交换」的交互一步。
 * 用于 UI 或纯 reducer：第一次点击记录 first，第二次点击与 first 组成交换对并尝试 swap。
 */
export type SwapInteractionEvent =
  | { readonly type: "cell_click"; readonly cell: CellPos }
  | { readonly type: "clear_selection" }
  /** 推进一档连锁稳定化展示；仅在 {@link SwapInteractionState.playback} 非空时有效 */
  | { readonly type: "playback_advance" }
  | {
      readonly type: "start_level";
      readonly board: Board;
      readonly refillSeed: number;
      readonly levelConfig: LevelConfig;
    };

/**
 * 每波连锁结束态之间的间隔（毫秒）。为 0 时交换接受后一次性稳定化，行为与接入步骤序列前一致。
 * UI 应用同一常量驱动定时器。
 */
export const STABILIZATION_PLAYBACK_MS_PER_WAVE = 320;

/** 交换已接受、正按 {@link StabilizationStepSequence} 分步展示盘面时尚未写入本步得分与连锁统计 */
export interface StabilizationPlaybackState {
  readonly sequence: StabilizationStepSequence;
  /**
   * 已展示到第几波结束态：0 表示当前盘面为交换后、首波消除前的盘面；
   * 每次 `playback_advance` 后递增，直至等于 `sequence.steps.length` 时结算并清空。
   */
  readonly completedWaves: number;
}

export interface SwapInteractionState {
  readonly board: Board;
  readonly pick: SwapPickState;
  readonly lastResult: AdjacentSwapAttemptResult | null;
  /** 最近一次有效交换后，本步稳定化（三消消除 + 连锁加成）累计得分 */
  readonly turnMatchScore: number;
  /** 最近一次有效交换触发的连锁波次数（无有效交换时为 0） */
  readonly chainWaves: number;
  /** 补位随机种子；传入 {@link stabilizeAfterSwap} 以保证可复现 */
  readonly refillSeed: number;
  /** 当前关卡参数（目标分、步数上限等） */
  readonly levelConfig: LevelConfig;
  /** 当局累计总分 */
  readonly totalScore: number;
  /** 剩余步数 */
  readonly movesRemaining: number;
  /** 当前分数已达到或超过目标分，可判定胜利 */
  readonly meetsWinTarget: boolean;
  /** 步数用尽且未达目标分 */
  readonly isFailed: boolean;
  /** 非空表示连锁稳定化步骤正在播放，此时应禁止新的选格与交换 */
  readonly playback: StabilizationPlaybackState | null;
}

export interface CreateSwapInteractionStateOptions {
  readonly refillSeed?: number;
  readonly levelConfig?: LevelConfig;
}

export function createSwapInteractionState(
  board: Board,
  options?: CreateSwapInteractionStateOptions,
): SwapInteractionState {
  const levelConfig = options?.levelConfig ?? getLevelConfigForIndex(0);
  const totalScore = 0;
  const meetsWinTarget = totalScore >= levelConfig.targetScore;
  const isFailed = levelConfig.moves === 0 && !meetsWinTarget;
  return {
    board,
    pick: { phase: "idle" },
    lastResult: null,
    turnMatchScore: 0,
    chainWaves: 0,
    refillSeed: options?.refillSeed ?? 0x2026_0414,
    levelConfig,
    totalScore,
    movesRemaining: levelConfig.moves,
    meetsWinTarget,
    isFailed,
    playback: null,
  };
}

function finalizePlaybackState(
  base: SwapInteractionState,
  sequence: StabilizationStepSequence,
): SwapInteractionState {
  const newTotal = base.totalScore + sequence.totalScore;
  const meetsWinTarget = newTotal >= base.levelConfig.targetScore;
  const isFailed = base.movesRemaining === 0 && !meetsWinTarget;
  return {
    ...base,
    board: sequence.finalBoard,
    playback: null,
    refillSeed: sequence.refillSeedAfter,
    totalScore: newTotal,
    turnMatchScore: sequence.totalScore,
    chainWaves: sequence.chainWaves,
    meetsWinTarget,
    isFailed,
  };
}

/**
 * 若第二次点击与第一次正交相邻，则调用 attemptAdjacentSwap；否则仅更新选中格或清除。
 */
export function reduceSwapInteraction(
  state: SwapInteractionState,
  event: SwapInteractionEvent,
): SwapInteractionState {
  if (event.type === "start_level") {
    return createSwapInteractionState(event.board, {
      refillSeed: event.refillSeed,
      levelConfig: event.levelConfig,
    });
  }

  if (event.type === "playback_advance") {
    if (!state.playback) {
      return state;
    }
    const { sequence, completedWaves } = state.playback;
    const next = completedWaves + 1;
    if (next < sequence.steps.length) {
      return {
        ...state,
        board: sequence.steps[next - 1]!.boardAfterGravityRefill,
        playback: { sequence, completedWaves: next },
      };
    }
    return finalizePlaybackState(state, sequence);
  }

  if (event.type === "clear_selection") {
    if (state.playback) {
      return {
        ...state,
        pick: { phase: "idle" },
      };
    }
    return {
      ...state,
      pick: { phase: "idle" },
      lastResult: null,
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  if (event.type !== "cell_click") {
    return state;
  }

  const cell = event.cell;

  if (state.playback) {
    return state;
  }

  if (state.meetsWinTarget || state.isFailed) {
    return {
      ...state,
      lastResult: {
        kind: "ignored",
        board: state.board,
        reason: "game_ended",
      },
      pick: { phase: "idle" },
      turnMatchScore: 0,
      chainWaves: 0,
      playback: null,
    };
  }

  if (state.pick.phase === "idle") {
    return {
      ...state,
      pick: { phase: "first", first: cell },
      lastResult: null,
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  const first = state.pick.first;
  if (first.row === cell.row && first.col === cell.col) {
    return {
      ...state,
      pick: { phase: "idle" },
      lastResult: null,
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  const result = attemptAdjacentSwap(state.board, first, cell);

  if (result.kind === "ignored") {
    return {
      ...state,
      lastResult: result,
      pick: { phase: "first", first },
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  if (result.kind === "rejected") {
    return {
      ...state,
      board: result.board,
      lastResult: result,
      pick: { phase: "idle" },
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  const sequence = buildStabilizationStepSequence(result.board, {
    refillSeed: state.refillSeed,
  });
  const movesAfter = state.movesRemaining - 1;
  const useInstantPlayback =
    STABILIZATION_PLAYBACK_MS_PER_WAVE <= 0 || sequence.steps.length === 0;

  if (useInstantPlayback) {
    const stabilized = stabilizeAfterSwap(result.board, { refillSeed: state.refillSeed });
    const newTotal = state.totalScore + stabilized.score;
    const meetsWinTarget = newTotal >= state.levelConfig.targetScore;
    const isFailed = movesAfter === 0 && !meetsWinTarget;
    return {
      board: stabilized.board,
      lastResult: result,
      pick: { phase: "idle" },
      turnMatchScore: stabilized.score,
      chainWaves: stabilized.chainWaves,
      refillSeed: stabilized.refillSeedAfter,
      levelConfig: state.levelConfig,
      totalScore: newTotal,
      movesRemaining: movesAfter,
      meetsWinTarget,
      isFailed,
      playback: null,
    };
  }

  return {
    ...state,
    board: result.board,
    lastResult: result,
    pick: { phase: "idle" },
    turnMatchScore: 0,
    chainWaves: 0,
    movesRemaining: movesAfter,
    meetsWinTarget: false,
    isFailed: false,
    playback: {
      sequence,
      completedWaves: 0,
    },
  };
}

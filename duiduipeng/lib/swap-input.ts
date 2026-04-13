import type { Board, LevelConfig } from "./board-types";
import type { AdjacentSwapAttemptResult, CellPos, SwapPickState } from "./swap-types";
import { getLevelConfigForIndex } from "./level-progression";
import { attemptAdjacentSwap } from "./swap-legality";
import { stabilizeAfterSwap } from "./stabilization";

/**
 * 表示「选格 → 与第二格尝试相邻交换」的交互一步。
 * 用于 UI 或纯 reducer：第一次点击记录 first，第二次点击与 first 组成交换对并尝试 swap。
 */
export type SwapInteractionEvent =
  | { readonly type: "cell_click"; readonly cell: CellPos }
  | { readonly type: "clear_selection" };

export interface SwapInteractionState {
  readonly board: Board;
  readonly pick: SwapPickState;
  readonly lastResult: AdjacentSwapAttemptResult | null;
  /** 最近一次有效交换后，本步稳定化（三消 + 对碰合并 + 连锁加成）累计得分 */
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
  };
}

/**
 * 若第二次点击与第一次正交相邻，则调用 attemptAdjacentSwap；否则仅更新选中格或清除。
 */
export function reduceSwapInteraction(
  state: SwapInteractionState,
  event: SwapInteractionEvent,
): SwapInteractionState {
  if (event.type === "clear_selection") {
    return {
      ...state,
      pick: { phase: "idle" },
      lastResult: null,
      turnMatchScore: 0,
      chainWaves: 0,
    };
  }

  const cell = event.cell;

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

  const stabilized = stabilizeAfterSwap(result.board, { refillSeed: state.refillSeed });
  const newTotal = state.totalScore + stabilized.score;
  const movesAfter = state.movesRemaining - 1;
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
  };
}

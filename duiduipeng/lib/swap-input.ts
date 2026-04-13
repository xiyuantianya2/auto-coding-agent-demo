import type { Board } from "./board-types";
import type { AdjacentSwapAttemptResult, CellPos, SwapPickState } from "./swap-types";
import { applyMatchClear } from "./match-clear";
import { attemptAdjacentSwap } from "./swap-legality";

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
  /** 最近一次有效交换后，三消消除阶段累计的基础分（无三消、仅对碰预备时保持 0） */
  readonly turnMatchScore: number;
}

export function createSwapInteractionState(board: Board): SwapInteractionState {
  return { board, pick: { phase: "idle" }, lastResult: null, turnMatchScore: 0 };
}

/**
 * 若第二次点击与第一次正交相邻，则调用 attemptAdjacentSwap；否则仅更新选中格或清除。
 */
export function reduceSwapInteraction(
  state: SwapInteractionState,
  event: SwapInteractionEvent,
): SwapInteractionState {
  if (event.type === "clear_selection") {
    return { ...state, pick: { phase: "idle" }, lastResult: null, turnMatchScore: 0 };
  }

  const cell = event.cell;
  if (state.pick.phase === "idle") {
    return { ...state, pick: { phase: "first", first: cell }, lastResult: null, turnMatchScore: 0 };
  }

  const first = state.pick.first;
  if (first.row === cell.row && first.col === cell.col) {
    return { ...state, pick: { phase: "idle" }, lastResult: null, turnMatchScore: 0 };
  }

  const result = attemptAdjacentSwap(state.board, first, cell);

  if (result.kind === "ignored") {
    return {
      ...state,
      lastResult: result,
      pick: { phase: "first", first },
      turnMatchScore: 0,
    };
  }

  if (result.kind === "rejected") {
    return {
      ...state,
      board: result.board,
      lastResult: result,
      pick: { phase: "idle" },
      turnMatchScore: 0,
    };
  }

  const cleared = applyMatchClear(result.board);
  return {
    board: cleared.board,
    lastResult: result,
    pick: { phase: "idle" },
    turnMatchScore: cleared.score,
  };
}

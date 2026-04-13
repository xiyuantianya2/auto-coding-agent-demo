import type { Board } from "./board-types";

/** 棋盘上的格坐标（0 起算：行、列） */
export interface CellPos {
  readonly row: number;
  readonly col: number;
}

/**
 * 一次「选两格并尝试交换」的输入：先选中的格与第二格。
 * 仅当两格为上下左右相邻且均在棋盘内时才会尝试交换（否则在交互层忽略）。
 */
export type AdjacentSwapInput = readonly [CellPos, CellPos];

/** 选格状态机：用于 UI 或 reducer 表示「点第一格 → 点第二格」 */
export type SwapPickState =
  | { readonly phase: "idle" }
  | { readonly phase: "first"; readonly first: CellPos };

export interface AdjacentSwapAttemptResult {
  readonly kind: "accepted" | "rejected" | "ignored";
  /** 与输入局面相同引用表示未改动（拒绝或忽略时） */
  readonly board: Board;
  readonly reason?:
    | "same_cell"
    | "out_of_bounds"
    | "not_orthogonal_adjacent"
    | "same_symbol_noop"
    | "no_match"
    | "empty_cell"
    | "game_ended";
}

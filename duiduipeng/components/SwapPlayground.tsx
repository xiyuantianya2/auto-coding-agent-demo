"use client";

import { useMemo, useReducer } from "react";
import { createInitialBoard } from "@/lib/create-initial-board";
import { CellSymbol, isEmptyCell } from "@/lib/board-types";
import { mulberry32 } from "@/lib/seeded-random";
import {
  createSwapInteractionState,
  reduceSwapInteraction,
  type SwapInteractionState,
} from "@/lib/swap-input";

const symbolClass: Record<CellSymbol, string> = {
  [CellSymbol.Ruby]: "bg-rose-600/90",
  [CellSymbol.Emerald]: "bg-emerald-600/90",
  [CellSymbol.Sapphire]: "bg-sky-600/90",
  [CellSymbol.Amber]: "bg-amber-500/90",
  [CellSymbol.Amethyst]: "bg-violet-600/90",
};

export function SwapPlayground() {
  const initialBoard = useMemo(
    () => createInitialBoard({ rows: 6, cols: 6, random: mulberry32(2026) }),
    [],
  );

  const [state, dispatch] = useReducer(
    (s: SwapInteractionState, cell: { row: number; col: number }) =>
      reduceSwapInteraction(s, { type: "cell_click", cell }),
    initialBoard,
    (board) => createSwapInteractionState(board, { refillSeed: 2026 }),
  );

  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;

  const statusText =
    state.meetsWinTarget
      ? "已达目标分数：本关可判定胜利（任务 10 将接入完整结算）。"
      : state.isFailed
        ? "步数用尽且未达目标：本关失败（任务 10 将接入重试）。"
        : state.lastResult === null
          ? "点选一格，再点相邻一格尝试交换（仅上下左右）。非法交换不消耗步数。"
          : state.lastResult.kind === "accepted"
            ? state.turnMatchScore > 0
              ? `交换有效：连锁 ${state.chainWaves} 波，本步 +${state.turnMatchScore} 分（含连锁加成）。`
              : "交换有效：盘面无三消或可对碰的二连（不应出现于合法交换）。"
            : state.lastResult.kind === "rejected"
              ? `交换无效：${state.lastResult.reason ?? "未触发消除或合并"}，盘面已回滚，不消耗步数。`
              : state.lastResult.reason === "game_ended"
                ? "对局已结束，无法继续交换。"
                : `未尝试交换：${state.lastResult.reason ?? "非相邻或对角线忽略"}。`;

  const target = state.levelConfig.targetScore;
  const winReady = state.meetsWinTarget;
  const failState = state.isFailed;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4 text-left">
      <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
        <span>
          关卡 <span className="font-semibold text-emerald-400">{state.levelConfig.levelIndex + 1}</span>
        </span>
        <span>
          分数{" "}
          <span className="font-semibold text-amber-300">{state.totalScore}</span>
          <span className="text-zinc-500"> / {target}</span>
        </span>
        <span>
          剩余步数{" "}
          <span
            className={`font-semibold ${failState ? "text-rose-400" : "text-zinc-100"}`}
          >
            {state.movesRemaining}
          </span>
        </span>
        <span
          className={
            winReady
              ? "font-semibold text-emerald-400"
              : failState
                ? "font-semibold text-rose-400"
                : "text-zinc-500"
          }
        >
          {winReady ? "可胜利" : failState ? "失败" : "进行中"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">{statusText}</p>
      <div
        className="inline-grid gap-1 p-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 2.25rem))`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const sym = state.board[r]![c]!;
          const empty = isEmptyCell(sym);
          const picked =
            state.pick.phase === "first" &&
            state.pick.first.row === r &&
            state.pick.first.col === c;
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-md text-[10px] font-semibold shadow-inner ring-offset-2 ring-offset-zinc-900 transition ${
                empty
                  ? "border border-dashed border-zinc-600 bg-zinc-900/80 text-zinc-500"
                  : `text-white ${symbolClass[sym as CellSymbol]} ${picked ? "ring-2 ring-amber-300" : "hover:brightness-110"}`
              }`}
              aria-label={`cell ${r} ${c}`}
              onClick={() => dispatch({ row: r, col: c })}
            >
              {empty ? "·" : sym}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="text-xs text-zinc-500 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300"
        onClick={() => {
          window.location.reload();
        }}
      >
        重置随机盘面
      </button>
    </div>
  );
}

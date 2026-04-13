"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createInitialBoard } from "@/lib/create-initial-board";
import { CellSymbol, isEmptyCell } from "@/lib/board-types";
import { mulberry32 } from "@/lib/seeded-random";
import { cn } from "@/lib/utils";
import {
  createSwapInteractionState,
  reduceSwapInteraction,
  type SwapInteractionState,
} from "@/lib/swap-input";
import type { CellPos } from "@/lib/swap-types";

const symbolClass: Record<CellSymbol, string> = {
  [CellSymbol.Ruby]:
    "bg-gradient-to-b from-rose-500/95 to-rose-700/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  [CellSymbol.Emerald]:
    "bg-gradient-to-b from-emerald-500/95 to-emerald-800/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  [CellSymbol.Sapphire]:
    "bg-gradient-to-b from-sky-500/95 to-sky-800/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  [CellSymbol.Amber]:
    "bg-gradient-to-b from-amber-400/95 to-amber-700/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  [CellSymbol.Amethyst]:
    "bg-gradient-to-b from-violet-500/95 to-violet-800/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
};

/** 与连连看棋盘类似的符号展示（颜色 + 易区分图形） */
const symbolEmoji: Record<CellSymbol, string> = {
  [CellSymbol.Ruby]: "🔴",
  [CellSymbol.Emerald]: "🟢",
  [CellSymbol.Sapphire]: "🔵",
  [CellSymbol.Amber]: "🟡",
  [CellSymbol.Amethyst]: "🟣",
};

function posEq(a: CellPos, b: CellPos): boolean {
  return a.row === b.row && a.col === b.col;
}

function rejectionToast(reason?: string): string {
  switch (reason) {
    case "no_match_or_merge":
      return "未形成三消或对碰，已还原";
    case "same_symbol_noop":
      return "同色交换无效，已还原";
    case "empty_cell":
      return "空格无法参与交换";
    default:
      return "交换无效，盘面已还原";
  }
}

export function SwapPlayground() {
  const initialBoard = useMemo(
    () => createInitialBoard({ rows: 6, cols: 6, random: mulberry32(2026) }),
    [],
  );

  const [state, dispatch] = useReducer(
    (s: SwapInteractionState, cell: CellPos) =>
      reduceSwapInteraction(s, { type: "cell_click", cell }),
    initialBoard,
    (board) => createSwapInteractionState(board, { refillSeed: 2026 }),
  );

  const attemptPairRef = useRef<readonly [CellPos, CellPos] | null>(null);
  const [flashPair, setFlashPair] = useState<readonly [CellPos, CellPos] | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [boardShake, setBoardShake] = useState(false);
  const [boardPulse, setBoardPulse] = useState(false);

  const onCellClick = useCallback(
    (cell: CellPos) => {
      if (state.meetsWinTarget || state.isFailed) return;

      if (state.pick.phase === "idle") {
        attemptPairRef.current = null;
      } else if (state.pick.phase === "first") {
        attemptPairRef.current = [state.pick.first, cell];
      }

      dispatch(cell);
    },
    [
      dispatch,
      state.meetsWinTarget,
      state.isFailed,
      state.pick,
    ],
  );

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  useEffect(() => {
    const lr = state.lastResult;
    if (!lr) return;
    let cancelled = false;

    if (lr.kind === "rejected") {
      const id0 = window.setTimeout(() => {
        if (cancelled) return;
        setToastMessage(rejectionToast(lr.reason));
        setBoardShake(true);
      }, 0);
      const id1 = window.setTimeout(() => {
        if (cancelled) return;
        setBoardShake(false);
      }, 450);
      return () => {
        cancelled = true;
        window.clearTimeout(id0);
        window.clearTimeout(id1);
      };
    }

    if (lr.kind === "accepted") {
      const id0 = window.setTimeout(() => {
        if (cancelled) return;
        const p = attemptPairRef.current;
        if (p) {
          setFlashPair(p);
          window.setTimeout(() => {
            if (!cancelled) setFlashPair(null);
          }, 320);
        } else {
          setBoardPulse(true);
          window.setTimeout(() => {
            if (!cancelled) setBoardPulse(false);
          }, 220);
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id0);
      };
    }

    return undefined;
  }, [state.lastResult]);

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
  const levelDisplay = state.levelConfig.levelIndex + 1;
  const ended = state.meetsWinTarget || state.isFailed;

  return (
    <div className="relative flex w-full min-w-0 flex-col items-stretch gap-6 text-left">
      {toastMessage ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[min(90vw,22rem)] -translate-x-1/2 rounded-xl border border-zinc-600 bg-zinc-900/95 px-4 py-2.5 text-center text-sm text-zinc-100 shadow-lg shadow-black/40"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-4 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300/95">
              第 {levelDisplay} 关
            </span>
            <h2 className="text-lg font-semibold text-zinc-100 sm:text-xl">
              对对碰
            </h2>
          </div>
          <p className="text-sm text-zinc-500">
            棋盘 {rows}×{cols} · 在步数内达到目标分
          </p>
        </div>
        <div
          className="grid w-full min-w-0 grid-cols-2 gap-3 sm:max-w-md sm:grid-cols-4"
          aria-label="游戏信息"
        >
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              关卡
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-emerald-300">
              {levelDisplay}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              得分
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-amber-200">
              {state.totalScore}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              目标
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-zinc-100">
              {target}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              剩余步数
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-lg font-semibold tabular-nums",
                state.isFailed ? "text-rose-400" : "text-zinc-100",
              )}
            >
              {state.movesRemaining}
            </p>
          </div>
        </div>
      </header>

      <p className="text-xs leading-relaxed text-zinc-400">{statusText}</p>

      <div
        className={cn(
          "w-full max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-zinc-800/90 bg-zinc-950/40 transition-transform duration-150 [-webkit-overflow-scrolling:touch]",
          boardPulse && "scale-[0.99]",
        )}
      >
        <div className="inline-block min-w-min p-2 sm:p-3">
          <div
            className={cn(
              "inline-grid gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-2 shadow-inner shadow-black/30 sm:gap-1.5 sm:p-3",
              boardShake && "ddp-board-shake",
              "[--cell:1.65rem] [--emoji:text-sm] sm:[--cell:2rem] sm:[--emoji:text-base] md:[--cell:2.5rem] md:[--emoji:text-lg]",
            )}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, var(--cell)))`,
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
              const isFlash =
                flashPair !== null &&
                (posEq(flashPair[0], { row: r, col: c }) ||
                  posEq(flashPair[1], { row: r, col: c }));

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={ended}
                  className={cn(
                    "flex aspect-square min-h-[var(--cell)] min-w-[var(--cell)] items-center justify-center rounded-lg text-[length:var(--emoji)] transition-[transform,box-shadow] duration-150",
                    empty &&
                      "cursor-default border border-dashed border-zinc-600 bg-zinc-950/70 text-zinc-500",
                    !empty &&
                      !ended &&
                      "text-white hover:brightness-110 active:scale-[0.97]",
                    !empty && symbolClass[sym as CellSymbol],
                    picked &&
                      "z-10 scale-[1.03] shadow-[0_0_0_2px_theme(colors.emerald.400),0_0_0_4px_theme(colors.zinc.900)]",
                    isFlash &&
                      "z-[8] shadow-[0_0_0_2px_theme(colors.amber.400),0_0_0_5px_theme(colors.zinc.900)]",
                    ended && !empty && "opacity-60",
                  )}
                  aria-pressed={picked}
                  aria-label={
                    empty
                      ? `空位 ${r + 1},${c + 1}`
                      : `棋子 ${r + 1},${c + 1}`
                  }
                  onClick={() => onCellClick({ row: r, col: c })}
                >
                  {empty ? "·" : symbolEmoji[sym as CellSymbol]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          onClick={() => {
            window.location.reload();
          }}
        >
          重置随机盘面
        </button>
      </div>
    </div>
  );
}

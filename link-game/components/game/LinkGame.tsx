"use client";

import { useCallback, useEffect, useState } from "react";

import { BoardGrid } from "@/components/game/BoardGrid";
import {
  enumerateConnectablePairs,
  type ConnectablePair,
} from "@/lib/game/connectivity";
import {
  createInitialPlayState,
  handleCellClick,
  restartPlayState,
} from "@/lib/game/game-state";
import { getLevelById } from "@/lib/game/levels";
import type { CellCoord } from "@/lib/game/types";

type LinkGameProps = {
  levelId?: number;
};

function formatMmSs(totalMs: number): string {
  const sec = Math.floor(totalMs / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LinkGame({ levelId = 1 }: LinkGameProps) {
  const level = getLevelById(levelId);
  if (!level) {
    throw new Error(`LinkGame: unknown level id ${levelId}`);
  }

  const [state, setState] = useState(() => createInitialPlayState(level));

  const [gameStartMs, setGameStartMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pausedAccumMs, setPausedAccumMs] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [winAtMs, setWinAtMs] = useState<number | null>(null);

  const [hintPair, setHintPair] = useState<ConnectablePair | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { board, selected, won } = state;

  useEffect(() => {
    if (!hintPair) return;
    const id = setTimeout(() => setHintPair(null), 2600);
    return () => clearTimeout(id);
  }, [hintPair]);

  useEffect(() => {
    if (!toastMessage) return;
    const id = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(id);
  }, [toastMessage]);

  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [won]);

  const getLiveElapsedMs = () => {
    const now = nowMs;
    const pauseExtra =
      paused && pauseStartedAt !== null ? now - pauseStartedAt : 0;
    return Math.max(0, now - gameStartMs - pausedAccumMs - pauseExtra);
  };

  const displayElapsedMs =
    won && winAtMs !== null
      ? Math.max(0, winAtMs - gameStartMs - pausedAccumMs)
      : getLiveElapsedMs();

  const onCellClick = useCallback(
    (coord: CellCoord) => {
      if (paused || won) return;
      setHintPair(null);
      setState((prev) => {
        const next = handleCellClick(prev, coord);
        if (next.won && !prev.won) {
          setWinAtMs(Date.now());
        }
        return next;
      });
    },
    [paused, won],
  );

  const onHint = useCallback(() => {
    if (paused || won) return;
    setToastMessage(null);
    const pairs = enumerateConnectablePairs(board);
    if (pairs.length === 0) {
      setToastMessage("当前没有可消的一对");
      return;
    }
    const pick = pairs[Math.floor(Math.random() * pairs.length)];
    setHintPair(pick);
  }, [board, paused, won]);

  const togglePause = useCallback(() => {
    if (won) return;
    if (!paused) {
      setPauseStartedAt(Date.now());
      setPaused(true);
    } else {
      if (pauseStartedAt !== null) {
        setPausedAccumMs((acc) => acc + (Date.now() - pauseStartedAt));
      }
      setPauseStartedAt(null);
      setPaused(false);
    }
  }, [won, paused, pauseStartedAt]);

  const onRestart = useCallback(() => {
    setState((s) => restartPlayState(s));
    const t = Date.now();
    setGameStartMs(t);
    setNowMs(t);
    setPausedAccumMs(0);
    setPauseStartedAt(null);
    setPaused(false);
    setWinAtMs(null);
    setHintPair(null);
    setToastMessage(null);
  }, []);

  return (
    <div className="relative flex w-full max-w-2xl flex-col items-stretch gap-6">
      {toastMessage ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-xl border border-zinc-600 bg-zinc-900/95 px-4 py-2.5 text-center text-sm text-zinc-100 shadow-lg shadow-black/40"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}
      <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-4 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300/95">
              第 {level.id} 关
            </span>
            <h2 className="truncate text-lg font-semibold text-zinc-100 sm:text-xl">
              {level.name}
            </h2>
          </div>
          <p className="text-sm text-zinc-500">
            棋盘 {level.rows}×{level.cols} · 图案 {level.tileKindCount} 种
          </p>
          <p
            className="font-mono text-sm tabular-nums text-zinc-300"
            aria-live="polite"
          >
            已用时间 {formatMmSs(displayElapsedMs)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 self-stretch sm:self-center sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={togglePause}
              disabled={won}
              className="rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {won ? "已结束" : paused ? "继续" : "暂停"}
            </button>
            <button
              type="button"
              onClick={onHint}
              disabled={won || paused}
              className="rounded-full border border-amber-600/80 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              提示
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              重新开始本关
            </button>
          </div>
          <p className="text-right text-xs text-zinc-500">提示不限次数</p>
        </div>
      </header>

      <BoardGrid
        board={board}
        selected={selected}
        hintPair={hintPair}
        won={won}
        onCellClick={onCellClick}
      />

      {won ? (
        <p
          className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-center text-emerald-200"
          role="status"
        >
          胜利：已全部消除。
        </p>
      ) : (
        <p className="max-w-md self-center text-center text-sm text-zinc-500">
          第一次点击选中；第二次若图案相同且路径可连（≤2 拐弯）则消除，否则以第二次为新的选中。
          再点已选格子可取消。
        </p>
      )}
    </div>
  );
}

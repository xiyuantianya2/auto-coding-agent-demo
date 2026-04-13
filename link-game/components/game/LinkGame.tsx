"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createDeterministicStripeBoard } from "@/lib/game/board-generation";

import { BoardGrid } from "@/components/game/BoardGrid";
import {
  enumerateConnectablePairs,
  type ConnectablePair,
} from "@/lib/game/connectivity";
import {
  createInitialPlayState,
  handleCellClick,
  restartPlayState,
  type PlayState,
} from "@/lib/game/game-state";
import { DEFAULT_LEVELS, getLevelById, getNextLevelId } from "@/lib/game/levels";
import type { CellCoord, LevelConfig } from "@/lib/game/types";

type LinkGameProps = {
  /** 起始关卡 id（默认 1）。 */
  levelId?: number;
};

function formatMmSs(totalMs: number): string {
  const sec = Math.floor(totalMs / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const AUTO_NEXT_MS = 2600;

function createPlayStateForLevel(level: LevelConfig): PlayState {
  try {
    return createInitialPlayState(level);
  } catch {
    return {
      level,
      board: createDeterministicStripeBoard(level),
      selected: null,
      won: false,
    };
  }
}

export function LinkGame({ levelId: initialLevelId = 1 }: LinkGameProps) {
  const [currentLevelId, setCurrentLevelId] = useState(initialLevelId);
  const [maxUnlockedLevelId, setMaxUnlockedLevelId] = useState(initialLevelId);

  const level = getLevelById(currentLevelId);
  if (!level) {
    throw new Error(`LinkGame: unknown level id ${currentLevelId}`);
  }

  /**
   * 棋盘仅在客户端 `useEffect` 中生成：`useState(null)` 在 SSR 与首屏 hydration 时一致，不会双次 `Math.random()`。
   * 此处必须同步 `setState`，勿用 `setTimeout(0)`——否则在部分环境下定时器可能被取消/延迟过久，导致永远停在「加载棋盘…」。
   */
  const [state, setState] = useState<PlayState | null>(null);

  const [gameStartMs, setGameStartMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pausedAccumMs, setPausedAccumMs] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [winAtMs, setWinAtMs] = useState<number | null>(null);

  const [hintPair, setHintPair] = useState<ConnectablePair | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [autoNextLevel, setAutoNextLevel] = useState(true);

  const selected = state?.selected ?? null;
  const won = state?.won ?? false;

  useEffect(() => {
    const lvl = getLevelById(currentLevelId);
    if (!lvl) return;
    setState(createPlayStateForLevel(lvl));
  }, [currentLevelId]);

  const prevWonRef = useRef(false);
  useEffect(() => {
    if (won && !prevWonRef.current) {
      queueMicrotask(() => {
        setWinAtMs(Date.now());
        setMaxUnlockedLevelId((m) => {
          const unlockTarget = getNextLevelId(level.id) ?? level.id;
          return Math.max(m, unlockTarget);
        });
      });
    }
    prevWonRef.current = won;
  }, [won, level.id]);

  const nextLevelId = getNextLevelId(currentLevelId);
  const isLastLevel = nextLevelId === null;

  const applyLevel = useCallback((id: number) => {
    const lvl = getLevelById(id);
    if (!lvl) return;
    const idChanged = id !== currentLevelId;
    if (idChanged) {
      setCurrentLevelId(id);
      setState(null);
    }
    const t = Date.now();
    setGameStartMs(t);
    setNowMs(t);
    setPausedAccumMs(0);
    setPauseStartedAt(null);
    setPaused(false);
    setWinAtMs(null);
    setHintPair(null);
    setToastMessage(null);
    if (!idChanged) {
      setState(createPlayStateForLevel(lvl));
    }
  }, [currentLevelId]);

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
    if (state?.won) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [state?.won]);

  useEffect(() => {
    if (!state?.won || !autoNextLevel || isLastLevel) return;
    if (nextLevelId === null) return;
    const id = setTimeout(() => {
      applyLevel(nextLevelId);
    }, AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [state?.won, autoNextLevel, isLastLevel, nextLevelId, applyLevel]);

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

  const goToNextLevel = useCallback(() => {
    if (nextLevelId === null) return;
    applyLevel(nextLevelId);
  }, [nextLevelId, applyLevel]);

  const replayFromStart = useCallback(() => {
    setMaxUnlockedLevelId(initialLevelId);
    applyLevel(initialLevelId);
  }, [initialLevelId, applyLevel]);

  const selectLevel = useCallback(
    (id: number) => {
      if (id > maxUnlockedLevelId) return;
      applyLevel(id);
    },
    [maxUnlockedLevelId, applyLevel],
  );

  const onCellClick = useCallback(
    (coord: CellCoord) => {
      if (!state || paused || won) return;
      setHintPair(null);
      setState((prev) => {
        if (!prev) return prev;
        return handleCellClick(prev, coord);
      });
    },
    [state, paused, won],
  );

  const onHint = useCallback(() => {
    if (!state || paused || won) return;
    setToastMessage(null);
    const pairs = enumerateConnectablePairs(state.board);
    if (pairs.length === 0) {
      setToastMessage("当前没有可消的一对");
      return;
    }
    const pick = pairs[Math.floor(Math.random() * pairs.length)];
    setHintPair(pick);
  }, [state, paused, won]);

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
    setState((s) => {
      const lvl = getLevelById(currentLevelId);
      if (!lvl) return s;
      return s ? restartPlayState(s) : createPlayStateForLevel(lvl);
    });
    const t = Date.now();
    setGameStartMs(t);
    setNowMs(t);
    setPausedAccumMs(0);
    setPauseStartedAt(null);
    setPaused(false);
    setWinAtMs(null);
    setHintPair(null);
    setToastMessage(null);
  }, [currentLevelId]);

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

      <section
        className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 sm:px-5"
        aria-label="关卡选择"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          关卡（顺序解锁）
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_LEVELS.map((lv) => {
            const locked = lv.id > maxUnlockedLevelId;
            const active = lv.id === currentLevelId;
            return (
              <button
                key={lv.id}
                type="button"
                onClick={() => selectLevel(lv.id)}
                disabled={locked}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-100"
                    : "border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800",
                  locked
                    ? "cursor-not-allowed opacity-45"
                    : "cursor-pointer",
                ].join(" ")}
                title={
                  locked
                    ? "尚未解锁：请先完成前一关"
                    : `${lv.name}（${lv.rows}×${lv.cols}）`
                }
              >
                {lv.id}. {lv.name}
                {locked ? " · 未解锁" : ""}
              </button>
            );
          })}
        </div>
      </section>

      {state ? (
        <BoardGrid
          board={state.board}
          selected={selected}
          hintPair={hintPair}
          won={won}
          onCellClick={onCellClick}
        />
      ) : (
        <div
          role="status"
          className="flex min-h-[18rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 py-12 text-sm text-zinc-400"
        >
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400"
            aria-hidden
          />
          加载棋盘…
        </div>
      )}

      {won && !isLastLevel ? (
        <div
          className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-4 text-center text-emerald-100"
          role="status"
        >
          <p className="font-medium">本关已完成</p>
          <p className="text-sm text-emerald-200/90">
            {autoNextLevel
              ? `将在约 ${Math.round(AUTO_NEXT_MS / 1000)} 秒后自动进入下一关；也可立即点击按钮。`
              : "点击「下一关」继续。"}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={goToNextLevel}
              className="rounded-full border border-emerald-400/80 bg-emerald-600/30 px-6 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-600/45"
            >
              下一关
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-200/90">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-emerald-600/80 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                checked={autoNextLevel}
                onChange={(e) => setAutoNextLevel(e.target.checked)}
              />
              过关自动进入下一关
            </label>
          </div>
        </div>
      ) : null}

      {won && isLastLevel ? (
        <div
          className="space-y-4 rounded-lg border border-sky-500/40 bg-sky-950/40 px-5 py-5 text-center text-sky-50"
          role="status"
        >
          <p className="text-lg font-semibold">恭喜，全部通关！</p>
          <p className="text-sm text-sky-100/85">
            你已完成「{DEFAULT_LEVELS[0]?.name}」至「{level.name}
            」全部关卡。
          </p>
          <button
            type="button"
            onClick={replayFromStart}
            className="rounded-full border border-sky-400/70 bg-sky-600/35 px-6 py-2 text-sm font-semibold text-sky-50 hover:bg-sky-600/50"
          >
            再玩一次
          </button>
        </div>
      ) : null}

      {!won ? (
        <p className="max-w-md self-center text-center text-sm text-zinc-500">
          第一次点击选中；第二次若图案相同且路径可连（≤2 拐弯）则消除，否则以第二次为新的选中。
          再点已选格子可取消。
        </p>
      ) : null}
    </div>
  );
}

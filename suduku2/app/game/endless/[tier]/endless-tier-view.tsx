"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { isVictory, serializeGameState, type GameState } from "@/lib/core";
import { gameStateFromGivensGrid } from "@/lib/generator/grid-game-state";
import {
  fetchProgress,
  isDifficultyTier,
  patchProgress,
  type ProgressPayload,
} from "@/app/progress-api";
import { useSudoku2Auth } from "@/app/auth-context";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";
import { ENDLESS_TIER_LABEL_ZH } from "@/app/game/endless/endless-meta";
import { SudokuPlaySurface } from "@/app/game/sudoku-play-surface";
import type { DifficultyTier, PuzzleSpec } from "@/server/types";

const REQUEST_TIMEOUT_MS = 8000;

type Phase =
  | { kind: "loading" }
  | { kind: "playing"; clearedLevel: number; nextLevel: number; spec: PuzzleSpec }
  | { kind: "pool-not-ready"; clearedLevel: number; nextLevel: number; maxPreparedLevel: number }
  | { kind: "error"; message: string };

function countGivens(g: number[][]): number {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = g[r]?.[c];
      if (typeof v === "number" && v > 0) {
        n += 1;
      }
    }
  }
  return n;
}

export function EndlessTierView(props: { tierParam: string }): JSX.Element {
  const { tierParam } = props;
  const tier: DifficultyTier | null = isDifficultyTier(tierParam) ? tierParam : null;

  const router = useRouter();
  const apiBase = useSudoku2ApiBase();
  const { token } = useSudoku2Auth();

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  const winSavedRef = useRef(false);
  const enterSavedRef = useRef(false);

  const tierLabel = tier ? ENDLESS_TIER_LABEL_ZH[tier] : "未知";

  const loadRun = useCallback(async () => {
    if (!tier || !token) {
      return;
    }
    winSavedRef.current = false;
    enterSavedRef.current = false;
    setJustWon(false);
    setStatusHint(null);
    setSelected(null);
    setGameState(null);
    setPhase({ kind: "loading" });

    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await fetchProgress(apiBase, token, ctrl.signal);
      setProgress(data);
      const cleared = data.endless[tier].clearedLevel;
      const nextLevel = cleared + 1;
      const spec = data.global[tier].puzzles[nextLevel];
      const maxPrepared = data.global[tier].maxPreparedLevel;

      if (!spec) {
        setPhase({
          kind: "pool-not-ready",
          clearedLevel: cleared,
          nextLevel,
          maxPreparedLevel: maxPrepared,
        });
        return;
      }

      const gs = gameStateFromGivensGrid(spec.givens);
      setGameState(gs);
      setPhase({ kind: "playing", clearedLevel: cleared, nextLevel, spec });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "请求超时（服务器可能在生成题目）。请稍后重试。"
          : e instanceof Error
            ? e.message
            : "加载失败，请稍后重试。";
      setPhase({ kind: "error", message: msg });
    } finally {
      globalThis.clearTimeout(timer);
    }
  }, [apiBase, tier, token]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (!tier || !token) {
      return;
    }
    if (phase.kind !== "playing" || !gameState) {
      return;
    }
    if (enterSavedRef.current) {
      return;
    }
    enterSavedRef.current = true;
    void (async () => {
      try {
        const wire = JSON.parse(serializeGameState(gameState)) as unknown;
        setBusy(true);
        await patchProgress(apiBase, token, { draft: wire });
        setStatusHint("已进入关卡：进度已同步（草稿）。");
      } catch (e) {
        setStatusHint(e instanceof Error ? e.message : "保存草稿失败。");
      } finally {
        setBusy(false);
      }
    })();
  }, [apiBase, gameState, phase.kind, tier, token]);

  useEffect(() => {
    if (!tier || !token) {
      return;
    }
    if (phase.kind !== "playing" || !gameState) {
      return;
    }
    if (!isVictory(gameState)) {
      return;
    }
    if (winSavedRef.current) {
      return;
    }
    winSavedRef.current = true;
    void (async () => {
      try {
        setBusy(true);
        const cleared = phase.clearedLevel;
        await patchProgress(apiBase, token, {
          endless: { [tier]: { clearedLevel: cleared + 1 } },
          draft: undefined,
        });
        setJustWon(true);
        setStatusHint("通关成功：关卡进度已同步。");
        const next = await fetchProgress(apiBase, token);
        setProgress(next);
      } catch (e) {
        setStatusHint(e instanceof Error ? e.message : "同步通关进度失败。");
      } finally {
        setBusy(false);
      }
    })();
  }, [apiBase, gameState, phase, tier, token]);

  const onSaveDraft = useCallback(async () => {
    if (!tier || !token || !gameState || phase.kind !== "playing") {
      return;
    }
    try {
      setBusy(true);
      const wire = JSON.parse(serializeGameState(gameState)) as unknown;
      await patchProgress(apiBase, token, { draft: wire });
      setStatusHint("草稿已保存。");
    } catch (e) {
      setStatusHint(e instanceof Error ? e.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  }, [apiBase, gameState, phase.kind, tier, token]);

  const onAbandon = useCallback(async () => {
    if (!tier || !token) {
      return;
    }
    try {
      setBusy(true);
      await patchProgress(apiBase, token, { draft: undefined });
      router.push("/game/endless");
    } catch (e) {
      setStatusHint(e instanceof Error ? e.message : "放弃失败。");
    } finally {
      setBusy(false);
    }
  }, [apiBase, router, tier, token]);

  const givensCount = useMemo(() => {
    if (phase.kind !== "playing") {
      return 0;
    }
    return countGivens(phase.spec.givens);
  }, [phase]);

  if (!tier) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--s2-text)]">
        <p className="text-sm text-[var(--s2-text-muted)]">无效的难度档位。</p>
        <p className="mt-6">
          <Link className="text-emerald-400 underline-offset-4 hover:underline" href="/game/endless">
            返回无尽模式
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 text-[var(--s2-text)] md:px-6 [@media(min-width:768px)_and_(orientation:landscape)]:max-w-5xl"
      data-testid="endless-play-root"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">无尽模式</p>
            <h1 className="mt-1 text-2xl font-semibold">{tierLabel}</h1>
          </div>
          <Link
            className="text-sm text-emerald-400/90 underline-offset-4 hover:underline"
            href="/game/endless"
            data-testid="endless-back"
          >
            返回选档
          </Link>
        </div>
        {progress ? (
          <p className="text-sm text-[var(--s2-text-muted)]" data-testid="endless-cleared">
            已通关：{progress.endless[tier].clearedLevel} 关 · 本题关卡编号：
            {phase.kind === "playing" ? phase.nextLevel : phase.kind === "pool-not-ready" ? phase.nextLevel : "—"}
          </p>
        ) : null}
        {phase.kind === "playing" ? (
          <p className="text-xs text-[var(--s2-text-subtle)]" data-testid="endless-meta">
            难度分：{phase.spec.difficultyScore.toFixed(1)} · 提示数：{givensCount} · 种子：{phase.spec.seed}
          </p>
        ) : null}
      </header>

      {phase.kind === "loading" ? (
        <p className="text-sm text-[var(--s2-text-muted)]" data-testid="endless-loading">
          加载进度与题库…
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
          <p>{phase.message}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] disabled:opacity-60"
            onClick={() => void loadRun()}
            disabled={busy}
            data-testid="endless-retry"
          >
            重试
          </button>
        </div>
      ) : null}

      {phase.kind === "pool-not-ready" ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-50"
          data-testid="endless-pool-wait"
        >
          <p className="leading-relaxed">
            第 {phase.nextLevel} 关题目尚未在服务器共享题库中就绪（当前已准备到第 {phase.maxPreparedLevel}{" "}
            关）。服务器可能在后台补缺生成，请勿频繁刷新以免重复触发。
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            onClick={() => void loadRun()}
            disabled={busy}
            data-testid="endless-refresh-pool"
          >
            刷新进度
          </button>
        </div>
      ) : null}

      {phase.kind === "playing" && gameState ? (
        <div className="flex flex-col gap-4">
          {justWon ? (
            <div
              className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-50"
              data-testid="endless-win-banner"
            >
              <p className="font-semibold">恭喜通关！</p>
              <p className="mt-2 text-emerald-100/90">下一关题目将从服务器题库加载。</p>
              <button
                type="button"
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => void loadRun()}
                disabled={busy}
                data-testid="endless-next-after-win"
              >
                进入下一关
              </button>
            </div>
          ) : null}

          <SudokuPlaySurface
            key={`${tier}-${phase.nextLevel}-${phase.spec.seed}`}
            gameState={gameState}
            onGameStateChange={setGameState}
            selected={selected}
            onSelectCell={(cell) => {
              setSelected(cell);
              if (!cell) {
                return;
              }
              setStatusHint(null);
            }}
            onPlayRejected={() => setStatusHint("该操作在当前模式下不可用。")}
            onNeedCellSelection={() => setStatusHint("请先点击一个空格。")}
            disabled={busy || justWon}
            boardTestId="endless-board"
            clearCellTestId="endless-clear-cell"
            extraRightColumn={
              <>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
                  onClick={() => void onSaveDraft()}
                  disabled={busy || justWon}
                  data-testid="endless-save-draft"
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40"
                  onClick={() => void onAbandon()}
                  disabled={busy}
                  data-testid="endless-abandon"
                >
                  放弃本关
                </button>
                {statusHint ? (
                  <p className="text-xs leading-relaxed text-[var(--s2-text-muted)]" data-testid="endless-status">
                    {statusHint}
                  </p>
                ) : null}
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { isVictory, serializeGameState, type GameState } from "@/lib/core";
import { gameStateFromGivensGrid } from "@/lib/generator/grid-game-state";
import {
  fetchProgress,
  patchProgress,
  type ProgressPayload,
} from "@/app/progress-api";
import { SudokuPlaySurface } from "@/app/game/sudoku-play-surface";
import { useSudoku2Auth } from "@/app/auth-context";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";
import { techniqueTitleZh } from "@/app/tutorial/technique-titles-zh";
import { getTechniqueCatalog } from "@/content/curriculum";
import type { PuzzleSpec } from "@/server/types";

const REQUEST_TIMEOUT_MS = 8000;

type Phase =
  | { kind: "loading" }
  | { kind: "no-mode" }
  | { kind: "invalid-mode" }
  | { kind: "locked"; techniqueTitle: string }
  | { kind: "playing"; spec: PuzzleSpec }
  | { kind: "error"; message: string };

function isUnlocked(
  techniques: ProgressPayload["techniques"] | undefined,
  techniqueId: string,
): boolean {
  return techniques?.[techniqueId]?.unlocked === true;
}

export function PracticeModeView(props: { modeId: string }): JSX.Element {
  const { modeId } = props;
  const router = useRouter();
  const apiBase = useSudoku2ApiBase();
  const { token } = useSudoku2Auth();

  const catalog = useMemo(() => getTechniqueCatalog(), []);
  const moduleMeta = useMemo(() => {
    if (!modeId) {
      return null;
    }
    return catalog.find((m) => m.practiceEndlessModeId === modeId) ?? null;
  }, [catalog, modeId]);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [justWon, setJustWon] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  const winSavedRef = useRef(false);
  const enterSavedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const title = moduleMeta ? techniqueTitleZh(moduleMeta.titleKey) : "专项练习";

  const loadPuzzle = useCallback(async () => {
    if (!token || !moduleMeta || !modeId) {
      return;
    }
    winSavedRef.current = false;
    enterSavedRef.current = false;
    setJustWon(false);
    setStatusHint(null);
    setSelected(null);
    setGameState(null);
    startedAtRef.current = null;

    setPhase({ kind: "loading" });
    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await fetchProgress(apiBase, token, ctrl.signal);
      setProgress(data);

      if (!isUnlocked(data.techniques, moduleMeta.id)) {
        setPhase({ kind: "locked", techniqueTitle: title });
        return;
      }

      const url = joinSudoku2ApiPath(
        apiBase,
        `/api/practice/puzzle?modeId=${encodeURIComponent(modeId)}`,
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = "加载题目失败，请稍后重试。";
        try {
          const w = JSON.parse(text) as { error?: { message?: string } };
          if (typeof w?.error?.message === "string" && w.error.message.length > 0) {
            msg = w.error.message;
          }
        } catch {
          /* ignore */
        }
        setPhase({ kind: "error", message: msg });
        return;
      }
      const payload = JSON.parse(text || "{}") as { spec?: PuzzleSpec };
      const spec = payload.spec;
      if (!spec || !Array.isArray(spec.givens)) {
        setPhase({ kind: "error", message: "服务器返回的题目数据无效。" });
        return;
      }

      const gs = gameStateFromGivensGrid(spec.givens);
      setGameState(gs);
      startedAtRef.current = Date.now();
      setPhase({ kind: "playing", spec });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "请求超时，请稍后重试。"
          : e instanceof Error
            ? e.message
            : "加载失败，请稍后重试。";
      setPhase({ kind: "error", message: msg });
    } finally {
      globalThis.clearTimeout(timer);
    }
  }, [apiBase, modeId, moduleMeta, title, token]);

  useEffect(() => {
    if (!modeId.trim()) {
      setPhase({ kind: "no-mode" });
      return;
    }
    if (!moduleMeta) {
      setPhase({ kind: "invalid-mode" });
      return;
    }
    void loadPuzzle();
  }, [loadPuzzle, modeId, moduleMeta]);

  useEffect(() => {
    if (!token || !moduleMeta) {
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
        setStatusHint("已进入专项：进度已同步（草稿）。");
      } catch (e) {
        setStatusHint(e instanceof Error ? e.message : "保存草稿失败。");
      } finally {
        setBusy(false);
      }
    })();
  }, [apiBase, gameState, moduleMeta, phase.kind, token]);

  useEffect(() => {
    if (!token || !moduleMeta || !modeId) {
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
        const t0 = startedAtRef.current ?? Date.now();
        const elapsedMs = Math.max(0, Date.now() - t0);
        const fresh = await fetchProgress(apiBase, token);
        const prev = fresh.practice[modeId];
        const nextStreak = (prev?.streak ?? 0) + 1;
        const prevBest = prev?.bestTimeMs;
        const nextBest =
          prevBest === undefined ? elapsedMs : Math.min(prevBest, elapsedMs);

        await patchProgress(apiBase, token, {
          practice: {
            [modeId]: { streak: nextStreak, bestTimeMs: nextBest },
          },
          draft: undefined,
        });
        setJustWon(true);
        setStatusHint("完成本局：专项进度已同步。");
        const next = await fetchProgress(apiBase, token);
        setProgress(next);
      } catch (e) {
        setStatusHint(e instanceof Error ? e.message : "同步专项进度失败。");
      } finally {
        setBusy(false);
      }
    })();
  }, [apiBase, gameState, modeId, moduleMeta, phase.kind, token]);

  const onSaveDraft = useCallback(async () => {
    if (!token || !gameState || phase.kind !== "playing") {
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
  }, [apiBase, gameState, phase.kind, token]);

  const onLeave = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setBusy(true);
      await patchProgress(apiBase, token, { draft: undefined });
      router.push("/tutorial");
    } catch (e) {
      setStatusHint(e instanceof Error ? e.message : "离开失败。");
    } finally {
      setBusy(false);
    }
  }, [apiBase, router, token]);

  const practiceStats =
    moduleMeta && progress ? progress.practice[moduleMeta.practiceEndlessModeId] : undefined;

  if (phase.kind === "no-mode") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--s2-text)]">
        <p className="text-sm text-[var(--s2-text-muted)]">未指定专项模式。请从教学大纲点击「专项练习」进入。</p>
        <p className="mt-6">
          <Link className="text-emerald-400 underline-offset-4 hover:underline" href="/tutorial">
            前往教学大纲
          </Link>
        </p>
      </div>
    );
  }

  if (phase.kind === "invalid-mode") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--s2-text)]">
        <p className="text-sm text-[var(--s2-text-muted)]">无效的专项模式参数。</p>
        <p className="mt-6">
          <Link className="text-emerald-400 underline-offset-4 hover:underline" href="/tutorial">
            返回教学大纲
          </Link>
        </p>
      </div>
    );
  }

  if (phase.kind === "locked") {
    return (
      <div
        className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-16 text-[var(--s2-text)]"
        data-testid="practice-locked-root"
      >
        <h1 className="text-xl font-semibold">{phase.techniqueTitle}</h1>
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-50"
          data-testid="practice-locked-gate"
          role="alert"
        >
          该技巧尚未解锁，无法进入专项练习。请先在教学大纲中完成前置学习，或继续推进无尽模式以解锁对应技巧。
        </div>
        <p>
          <Link
            className="text-emerald-400 underline-offset-4 hover:underline"
            href="/tutorial"
            data-testid="practice-back-tutorial"
          >
            返回教学大纲
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 text-[var(--s2-text)] md:px-6 [@media(min-width:768px)_and_(orientation:landscape)]:max-w-5xl"
      data-testid="practice-play-root"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">专项练习</p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          </div>
          <Link
            className="text-sm text-emerald-400/90 underline-offset-4 hover:underline"
            href="/tutorial"
            data-testid="practice-back-tutorial-header"
          >
            返回教学
          </Link>
        </div>
        {practiceStats ? (
          <p className="text-sm text-[var(--s2-text-muted)]" data-testid="practice-stats">
            连胜：{practiceStats.streak ?? 0} · 最佳用时：
            {typeof practiceStats.bestTimeMs === "number"
              ? `${Math.floor(practiceStats.bestTimeMs / 1000)} 秒`
              : "—"}
          </p>
        ) : (
          <p className="text-sm text-[var(--s2-text-muted)]" data-testid="practice-stats">
            连胜：0 · 最佳用时：—
          </p>
        )}
        {phase.kind === "playing" ? (
          <p className="text-xs text-[var(--s2-text-subtle)]" data-testid="practice-meta">
            难度分：{phase.spec.difficultyScore.toFixed(1)} · 种子：{phase.spec.seed}
          </p>
        ) : null}
      </header>

      {phase.kind === "loading" ? (
        <p className="text-sm text-[var(--s2-text-muted)]" data-testid="practice-loading">
          加载进度与题目…
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-100">
          <p>{phase.message}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] disabled:opacity-60"
            onClick={() => void loadPuzzle()}
            disabled={busy}
            data-testid="practice-retry"
          >
            重试
          </button>
        </div>
      ) : null}

      {phase.kind === "playing" && gameState ? (
        <div className="flex flex-col gap-4">
          {justWon ? (
            <div
              className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-50"
              data-testid="practice-win-banner"
            >
              <p className="font-semibold">恭喜完成本局！</p>
              <p className="mt-2 text-emerald-100/90">专项连胜与最佳用时已写入服务器进度。</p>
              <button
                type="button"
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => void loadPuzzle()}
                disabled={busy}
                data-testid="practice-next-round"
              >
                再来一局
              </button>
            </div>
          ) : null}

          <SudokuPlaySurface
            key={`${modeId}-${phase.spec.seed}`}
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
            boardTestId="practice-board"
            extraRightColumn={
              <>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
                  onClick={() => void onSaveDraft()}
                  disabled={busy || justWon}
                  data-testid="practice-save-draft"
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40"
                  onClick={() => void onLeave()}
                  disabled={busy}
                  data-testid="practice-leave"
                >
                  返回教学
                </button>
                {statusHint ? (
                  <p className="text-xs leading-relaxed text-[var(--s2-text-muted)]" data-testid="practice-status">
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

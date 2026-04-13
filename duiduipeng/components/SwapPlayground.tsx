"use client";

import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createInitialBoard } from "@/lib/create-initial-board";
import { CellSymbol, isEmptyCell, type Board } from "@/lib/board-types";
import { getLevelConfigForIndex } from "@/lib/level-progression";
import { mulberry32 } from "@/lib/seeded-random";
import { cn } from "@/lib/utils";
import { computeGravityRefillOffsets } from "@/lib/gravity-display";
import {
  CHAIN_INTER_WAVE_GAP_MS,
  createSwapInteractionState,
  GRAVITY_REFILL_MS,
  MATCH_CLEAR_MS,
  MATCH_CLEAR_STAGGER_MS,
  MATCH_HIGHLIGHT_MS,
  reduceSwapInteraction,
  type SwapInteractionEvent,
  type SwapInteractionState,
} from "@/lib/swap-input";
import { findFirstValidSwap } from "@/lib/swap-legality";
import type { CellPos } from "@/lib/swap-types";
import { GameInstructionsDialog } from "@/components/GameInstructionsDialog";

const HINT_COOLDOWN_MS = 8_000;
const MAX_HINTS_PER_GAME = 12;
const HINT_HIGHLIGHT_MS = 2_800;

const controlBtnClass =
  "inline-flex items-center justify-center rounded-full border border-emerald-500/45 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-200/95 shadow-sm shadow-emerald-950/30 transition-colors hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:border-zinc-600 disabled:bg-zinc-900/60 disabled:text-zinc-500 disabled:shadow-none";

function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

function posKey(p: CellPos): string {
  return `${p.row},${p.col}`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

type MatchFxPhase = "idle" | "highlight" | "clear";

type GravityAnimState = {
  readonly waveKey: string;
  readonly finalBoard: Board;
  readonly offsets: ReturnType<typeof computeGravityRefillOffsets>;
  phase: "invert" | "play";
};

function staggerIndexForCell(
  positions: readonly CellPos[],
  r: number,
  c: number,
): number {
  const k = `${r},${c}`;
  const idx = positions.findIndex((p) => posKey(p) === k);
  return idx;
}

function rejectionToast(reason?: string): string {
  switch (reason) {
    case "no_match":
      return "未形成三消，已还原";
    case "same_symbol_noop":
      return "同色交换无效，已还原";
    case "empty_cell":
      return "空格无法参与交换";
    default:
      return "交换无效，盘面已还原";
  }
}

/** 状态行用：与 {@link rejectionToast} 同义，略去「已还原」等 toast 尾语 */
function rejectionStatusDetail(reason?: string): string {
  switch (reason) {
    case "no_match":
      return "未形成三消";
    case "same_symbol_noop":
      return "同色交换无效";
    case "empty_cell":
      return "空格无法参与交换";
    default:
      return "条件不满足";
  }
}

export function SwapPlayground() {
  const initialBoard = useMemo(
    () => createInitialBoard({ rows: 6, cols: 6, random: mulberry32(2026) }),
    [],
  );

  const [state, dispatch] = useReducer(
    (s: SwapInteractionState, event: SwapInteractionEvent) =>
      reduceSwapInteraction(s, event),
    initialBoard,
    (board) => createSwapInteractionState(board, { refillSeed: 2026 }),
  );

  const attemptPairRef = useRef<readonly [CellPos, CellPos] | null>(null);
  const levelRunCounterRef = useRef(0);
  const [flashPair, setFlashPair] = useState<readonly [CellPos, CellPos] | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [boardShake, setBoardShake] = useState(false);
  const [boardPulse, setBoardPulse] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hintPair, setHintPair] = useState<readonly [CellPos, CellPos] | null>(
    null,
  );
  const [hintCooldownUntil, setHintCooldownUntil] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [matchFx, setMatchFx] = useState<MatchFxPhase>("idle");
  const [gravityAnim, setGravityAnim] = useState<GravityAnimState | null>(
    null,
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  const playbackActive = state.playback !== null;
  const ended = state.meetsWinTarget || state.isFailed;

  const bootstrapLevel = useCallback(
    (levelIndex: number) => {
      levelRunCounterRef.current += 1;
      const cfg = getLevelConfigForIndex(levelIndex);
      const seed =
        0x2026_0414 +
        levelIndex * 7919 +
        levelRunCounterRef.current * 9973;
      const board = createInitialBoard({
        rows: 6,
        cols: 6,
        random: mulberry32(seed),
      });
      dispatch({
        type: "start_level",
        board,
        refillSeed: seed,
        levelConfig: cfg,
      });
      setIsPaused(false);
      setElapsedSec(0);
      setHintsUsed(0);
      setHintCooldownUntil(0);
      setHintPair(null);
      setToastMessage(null);
      attemptPairRef.current = null;
    },
    [dispatch],
  );

  const confirmNewGameToLevel1 = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定要放弃当前进度并回到第 1 关吗？")
    ) {
      return;
    }
    bootstrapLevel(0);
  }, [bootstrapLevel]);

  useEffect(() => {
    if (ended || isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [ended, isPaused]);

  useEffect(() => {
    if (!hintPair) return;
    const id = window.setTimeout(() => setHintPair(null), HINT_HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [hintPair]);

  const onCellClick = useCallback(
    (cell: CellPos) => {
      if (isPaused) return;
      if (playbackActive) return;
      if (state.meetsWinTarget || state.isFailed) return;

      if (state.pick.phase === "idle") {
        attemptPairRef.current = null;
      } else if (state.pick.phase === "first") {
        attemptPairRef.current = [state.pick.first, cell];
      }

      dispatch({ type: "cell_click", cell });
    },
    [
      dispatch,
      isPaused,
      playbackActive,
      state.meetsWinTarget,
      state.isFailed,
      state.pick,
    ],
  );

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      const next = !p;
      if (next) {
        dispatch({ type: "clear_selection" });
        setHintPair(null);
      }
      return next;
    });
  }, [dispatch]);

  const onHint = useCallback(() => {
    if (state.meetsWinTarget) {
      setToastMessage("已达目标分数，无需提示");
      return;
    }
    if (state.isFailed) {
      setToastMessage("步数已用尽，对局已结束");
      return;
    }
    if (playbackActive) {
      setToastMessage("连锁播放中，请稍候再试提示");
      return;
    }
    if (isPaused) {
      setToastMessage("已暂停：请先点击「继续」");
      return;
    }
    if (hintsUsed >= MAX_HINTS_PER_GAME) {
      setToastMessage(`本局提示已用尽（${MAX_HINTS_PER_GAME} 次）`);
      return;
    }
    const now = Date.now();
    if (now < hintCooldownUntil) {
      const s = Math.ceil((hintCooldownUntil - now) / 1000);
      setToastMessage(`提示冷却中（${s}s）`);
      return;
    }
    const pair = findFirstValidSwap(state.board);
    if (!pair) {
      setToastMessage("当前无可行交换（盘面可能无解）");
      return;
    }
    setHintsUsed((n) => n + 1);
    setHintPair(pair);
    setHintCooldownUntil(now + HINT_COOLDOWN_MS);
  }, [
    hintCooldownUntil,
    hintsUsed,
    isPaused,
    playbackActive,
    state.board,
    state.isFailed,
    state.meetsWinTarget,
  ]);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  /**
   * 每波：高亮本批待消坐标（与 stabilization-steps 中 clearedPositions 一致）→ CSS 消除过渡 →
   * 重力/补位 FLIP（见 gravityAnim）→ playback_advance。
   * 错开时间由 MATCH_CLEAR_STAGGER_MS 配置，与逻辑层行主序一致。
   */
  useEffect(() => {
    if (!playbackActive || isPaused || ended) {
      setMatchFx("idle");
      return;
    }
    const pb = state.playback;
    if (!pb) {
      setMatchFx("idle");
      return;
    }
    const { sequence, completedWaves } = pb;
    if (completedWaves >= sequence.steps.length) {
      setMatchFx("idle");
      return;
    }

    const step = sequence.steps[completedWaves]!;
    const n = step.clearedCellCount;
    const clearPhaseMs =
      MATCH_CLEAR_MS + (n > 1 ? (n - 1) * MATCH_CLEAR_STAGGER_MS : 0);

    /** 第 2 波起在「上一波补位完成」与「本波高亮」之间插入间隔，避免多波视觉上连成一跳 */
    const interWaveMs =
      completedWaves > 0 && completedWaves < sequence.steps.length
        ? CHAIN_INTER_WAVE_GAP_MS
        : 0;

    let cancelled = false;
    let idInterWave: number | undefined;
    let idHighlight: number | undefined;
    let idAdvance: number | undefined;

    const beginWaveFx = () => {
      setMatchFx("highlight");
      idHighlight = window.setTimeout(() => {
        if (cancelled) return;
        setMatchFx("clear");
        idAdvance = window.setTimeout(() => {
          if (cancelled) return;
          if (prefersReducedMotion) {
            dispatch({ type: "playback_advance" });
            setMatchFx("idle");
            return;
          }
          const offsets = computeGravityRefillOffsets(
            step.boardAfterClear,
            step.boardAfterGravityRefill,
          );
          setGravityAnim({
            waveKey: `g-${completedWaves}-${step.waveIndex}`,
            finalBoard: step.boardAfterGravityRefill,
            offsets,
            phase: "invert",
          });
          setMatchFx("idle");
        }, clearPhaseMs);
      }, MATCH_HIGHLIGHT_MS);
    };

    if (interWaveMs > 0) {
      idInterWave = window.setTimeout(() => {
        if (cancelled) return;
        beginWaveFx();
      }, interWaveMs);
    } else {
      beginWaveFx();
    }

    return () => {
      cancelled = true;
      if (idInterWave !== undefined) window.clearTimeout(idInterWave);
      if (idHighlight !== undefined) window.clearTimeout(idHighlight);
      if (idAdvance !== undefined) window.clearTimeout(idAdvance);
      setMatchFx("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchFx 更新不应重跑本 effect，仅随播放进度/暂停变化
  }, [
    playbackActive,
    isPaused,
    ended,
    state.playback?.completedWaves,
    state.playback?.sequence,
    dispatch,
    prefersReducedMotion,
  ]);

  useLayoutEffect(
    () => {
      if (!gravityAnim || gravityAnim.phase !== "invert") return undefined;
      const { waveKey } = gravityAnim;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setGravityAnim((g) =>
            g && g.waveKey === waveKey && g.phase === "invert"
              ? { ...g, phase: "play" }
              : g,
          );
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- waveKey+phase 唯一定位单次 FLIP；完整 gravityAnim 会重复触发
    [gravityAnim?.waveKey, gravityAnim?.phase],
  );

  useEffect(
    () => {
      if (!gravityAnim || gravityAnim.phase !== "play" || isPaused || ended) {
        return;
      }
      const { waveKey } = gravityAnim;
      const id = window.setTimeout(() => {
        dispatch({ type: "playback_advance" });
        setGravityAnim((g) => (g && g.waveKey === waveKey ? null : g));
      }, GRAVITY_REFILL_MS);
      return () => window.clearTimeout(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- waveKey+phase 区分波次；避免依赖整个 gravityAnim
    [
      gravityAnim?.waveKey,
      gravityAnim?.phase,
      isPaused,
      ended,
      dispatch,
    ],
  );

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

  const displayBoard = gravityAnim !== null ? gravityAnim.finalBoard : state.board;
  const rows = displayBoard.length;
  const cols = displayBoard[0]?.length ?? 0;

  const playback = state.playback;
  const pendingMatchStep =
    playback !== null &&
    playback.completedWaves < playback.sequence.steps.length
      ? playback.sequence.steps[playback.completedWaves]
      : null;

  const statusText =
    playbackActive && isPaused && !ended
      ? "已暂停：连锁结算已冻结，用时冻结；点击「继续」后将从当前盘面继续播放。"
      : playbackActive && !isPaused && !ended
        ? "连锁结算播放中：暂不可选格或交换；可点击「暂停」冻结播放。"
        : isPaused && !ended
      ? "已暂停：无法交换，对局用时已冻结；点击「继续」恢复。"
      : state.meetsWinTarget
        ? "已达目标分数：在弹窗中确认进入下一关或开始新游戏。"
        : state.isFailed
          ? "步数用尽且未达目标：可在弹窗中重试本关或回到第 1 关。"
            : state.lastResult === null
            ? "点选一格，再点相邻一格尝试交换（仅上下左右）。非法交换不消耗步数。"
            : state.lastResult.kind === "accepted"
              ? playbackActive
                ? "交换已接受：连锁结果播放中，完成后更新得分与盘面终局。"
                : state.turnMatchScore > 0
                ? `交换有效：连锁 ${state.chainWaves} 波，本步 +${state.turnMatchScore} 分（含连锁加成）。`
                : "交换有效：本步未累计三消得分（不应出现于合法交换）。"
              : state.lastResult.kind === "rejected"
                ? `交换无效：${rejectionStatusDetail(state.lastResult.reason)}，盘面已回滚，不消耗步数。`
                : state.lastResult.reason === "game_ended"
                  ? "对局已结束，无法继续交换。"
                  : `未尝试交换：${state.lastResult.reason ?? "非相邻或对角线忽略"}。`;

  const target = state.levelConfig.targetScore;
  const levelDisplay = state.levelConfig.levelIndex + 1;

  return (
    <div className="relative flex w-full min-w-0 flex-col items-stretch gap-6 text-left">
      {ended ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 px-4 py-8 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ddp-endgame-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/90 bg-zinc-900/95 p-6 shadow-2xl shadow-black/50">
            <h3
              id="ddp-endgame-title"
              className="text-xl font-semibold text-zinc-50"
            >
              {state.meetsWinTarget ? "过关！" : "本关未达标"}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {state.meetsWinTarget ? (
                <>
                  得分{" "}
                  <span className="font-mono tabular-nums text-amber-200">
                    {state.totalScore}
                  </span>{" "}
                  已达到目标{" "}
                  <span className="font-mono tabular-nums text-zinc-100">
                    {state.levelConfig.targetScore}
                  </span>
                  。进入下一关将刷新棋盘与步数，分数从 0 重新累计。
                </>
              ) : (
                <>
                  剩余步数为 0，当前得分{" "}
                  <span className="font-mono tabular-nums text-amber-200">
                    {state.totalScore}
                  </span>{" "}
                  未达到目标{" "}
                  <span className="font-mono tabular-nums text-zinc-100">
                    {state.levelConfig.targetScore}
                  </span>
                  。可重试本关以保留关卡目标与步数上限。
                </>
              )}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              {state.meetsWinTarget ? (
                <button
                  type="button"
                  className={cn(controlBtnClass, "w-full sm:w-auto")}
                  onClick={() =>
                    bootstrapLevel(state.levelConfig.levelIndex + 1)
                  }
                >
                  下一关
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(controlBtnClass, "w-full sm:w-auto")}
                  onClick={() =>
                    bootstrapLevel(state.levelConfig.levelIndex)
                  }
                >
                  重试本关
                </button>
              )}
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/80 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 sm:w-auto"
                onClick={confirmNewGameToLevel1}
              >
                新游戏（第 1 关）
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[min(90vw,22rem)] -translate-x-1/2 rounded-xl border border-zinc-600 bg-zinc-900/95 px-4 py-2.5 text-center text-sm text-zinc-100 shadow-lg shadow-black/40"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-4 shadow-lg shadow-black/20 sm:px-5">
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300/95">
                第 {levelDisplay} 关
              </span>
              {isPaused && !ended ? (
                <span
                  className="inline-flex shrink-0 items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-200/95"
                  role="status"
                >
                  已暂停
                </span>
              ) : null}
              <h2 className="text-lg font-semibold text-zinc-100 sm:text-xl">
                对对碰
              </h2>
            </div>
            <p className="text-sm text-zinc-500">
              棋盘 {rows}×{cols} · 在步数内达到目标分
              {ended ? null : isPaused ? " · 用时已冻结" : ` · 用时 ${formatElapsed(elapsedSec)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center sm:pt-0.5">
            <GameInstructionsDialog testId="game-instructions-trigger-inline" />
          </div>
        </div>
        <div
          className="grid w-full min-w-0 grid-cols-2 gap-3 sm:max-w-3xl sm:grid-cols-5"
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
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              用时
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-lg font-semibold tabular-nums",
                isPaused && !ended ? "text-amber-200/90" : "text-zinc-100",
              )}
            >
              {formatElapsed(elapsedSec)}
            </p>
          </div>
        </div>
      </header>

      <p className="text-xs leading-relaxed text-zinc-400">{statusText}</p>

      <div
        className={cn(
          "relative w-full max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-zinc-800/90 bg-zinc-950/40 transition-transform duration-150 [-webkit-overflow-scrolling:touch]",
          boardPulse && "scale-[0.99]",
        )}
        data-ddp-playback={playbackActive ? "true" : "false"}
        data-ddp-match-fx={matchFx}
        data-ddp-gravity={
          gravityAnim ? (gravityAnim.phase === "play" ? "play" : "invert") : "idle"
        }
      >
        {isPaused && !ended ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-zinc-950/55 pt-4 backdrop-blur-[1px]"
            aria-hidden
          >
            <span className="rounded-full border border-amber-500/55 bg-zinc-900/95 px-4 py-2 text-sm font-semibold text-amber-100 shadow-lg shadow-black/40">
              {playbackActive ? "连锁播放已暂停" : "游戏已暂停"}
            </span>
          </div>
        ) : null}
        <div className="inline-block min-w-min p-2 sm:p-3">
          <div
            className={cn(
              "inline-grid gap-1 overflow-visible rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-2 shadow-inner shadow-black/30 sm:gap-1.5 sm:p-3",
              boardShake && "ddp-board-shake",
              "[--cell:1.65rem] [--emoji:text-sm] sm:[--cell:2rem] sm:[--emoji:text-base] md:[--cell:2.5rem] md:[--emoji:text-lg]",
              "[--ddp-pitch:calc(var(--cell)+0.25rem)] sm:[--ddp-pitch:calc(var(--cell)+0.375rem)]",
            )}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, var(--cell)))`,
            }}
          >
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const sym = displayBoard[r]![c]!;
              const empty = isEmptyCell(sym);
              const picked =
                state.pick.phase === "first" &&
                state.pick.first.row === r &&
                state.pick.first.col === c;
              const isFlash =
                flashPair !== null &&
                (posEq(flashPair[0], { row: r, col: c }) ||
                  posEq(flashPair[1], { row: r, col: c }));
              const isHint =
                hintPair !== null &&
                (posEq(hintPair[0], { row: r, col: c }) ||
                  posEq(hintPair[1], { row: r, col: c }));

              const stIdx = pendingMatchStep
                ? staggerIndexForCell(pendingMatchStep.clearedPositions, r, c)
                : -1;
              const inMatchBatch = stIdx >= 0;
              const matchHighlight =
                inMatchBatch && matchFx === "highlight" && !empty;
              const matchClear = inMatchBatch && matchFx === "clear" && !empty;

              const yu =
                gravityAnim && !empty
                  ? (gravityAnim.offsets[r]?.[c]?.translateYRowUnits ?? 0)
                  : 0;
              const gPhase = gravityAnim?.phase;
              const gravityInnerStyle: CSSProperties | undefined =
                gravityAnim && !empty
                  ? {
                      transform: `translateY(calc(${gPhase === "invert" ? yu : 0} * var(--ddp-pitch)))`,
                      transition:
                        gPhase === "play"
                          ? `transform ${GRAVITY_REFILL_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`
                          : "none",
                      willChange: "transform",
                    }
                  : undefined;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={ended || isPaused || playbackActive}
                  className={cn(
                    "flex aspect-square min-h-[var(--cell)] min-w-[var(--cell)] items-center justify-center rounded-lg text-[length:var(--emoji)] transition-[transform,box-shadow,opacity] duration-150",
                    empty &&
                      "cursor-default border border-dashed border-zinc-600 bg-zinc-950/70 text-zinc-500",
                    !empty &&
                      !ended &&
                      !isPaused &&
                      !playbackActive &&
                      "text-white hover:brightness-110 active:scale-[0.97]",
                    !empty && symbolClass[sym as CellSymbol],
                    picked &&
                      "z-10 scale-[1.03] shadow-[0_0_0_2px_theme(colors.emerald.400),0_0_0_4px_theme(colors.zinc.900)]",
                    isHint &&
                      "z-[7] shadow-[0_0_0_2px_theme(colors.sky.400),0_0_0_5px_theme(colors.zinc.900)]",
                    isFlash &&
                      "z-[8] shadow-[0_0_0_2px_theme(colors.amber.400),0_0_0_5px_theme(colors.zinc.900)]",
                    matchHighlight &&
                      "z-[16] scale-[1.03] shadow-[0_0_0_2px_rgba(52,211,153,0.92),0_0_18px_rgba(16,185,129,0.38)]",
                    ended && !empty && "opacity-60",
                  )}
                  style={
                    matchClear
                      ? {
                          transitionProperty: "opacity, transform",
                          transitionDuration: `${MATCH_CLEAR_MS}ms`,
                          transitionTimingFunction:
                            "cubic-bezier(0.33, 1, 0.68, 1)",
                          transitionDelay: `${stIdx * MATCH_CLEAR_STAGGER_MS}ms`,
                          opacity: 0,
                          transform: "scale(0.82)",
                        }
                      : undefined
                  }
                  aria-pressed={picked}
                  aria-label={
                    empty
                      ? `空位 ${r + 1},${c + 1}`
                      : `棋子 ${r + 1},${c + 1}`
                  }
                  onClick={() => onCellClick({ row: r, col: c })}
                >
                  <span
                    className={cn(
                      "inline-flex min-h-full min-w-full flex-1 items-center justify-center",
                      gravityAnim && !empty && "relative z-[5]",
                    )}
                    style={gravityInnerStyle}
                  >
                    {empty ? "·" : symbolEmoji[sym as CellSymbol]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:items-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="ddp-pause-toggle"
            className={controlBtnClass}
            disabled={ended}
            aria-pressed={isPaused}
            onClick={togglePause}
          >
            {isPaused ? "继续" : "暂停"}
          </button>
          <button
            type="button"
            data-testid="ddp-hint-button"
            className={controlBtnClass}
            disabled={ended}
            onClick={onHint}
          >
            提示
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={ended}
            onClick={confirmNewGameToLevel1}
          >
            新游戏（第 1 关）
          </button>
        </div>
        {!ended ? (
          <p className="text-center text-[11px] text-zinc-500">
            提示：每局最多 {MAX_HINTS_PER_GAME} 次，使用后 {HINT_COOLDOWN_MS / 1000}{" "}
            秒冷却；仅扫描盘面，不改变随机种子与得分。
          </p>
        ) : null}
      </div>
    </div>
  );
}

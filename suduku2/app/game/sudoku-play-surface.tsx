"use client";

import type { JSX, ReactNode } from "react";
import { useMemo, useRef } from "react";

import { EMPTY_CELL, getEffectiveDigitAt, type GameState } from "@/lib/core";
import { useFullscreen } from "@/lib/fullscreen";
import type { HintResult } from "@/lib/hint";
import { techniqueIdToZh } from "@/app/tutorial/technique-titles-zh";

import { useSudoku2Game } from "@/app/game/use-sudoku2-game";

export type SudokuPlaySurfaceProps = {
  gameState: GameState;
  onGameStateChange: (next: GameState) => void;
  disabled?: boolean;
  boardTestId?: string;
  clearCellTestId?: string;
  /** 渲染在控制区底部（如保存草稿） */
  extraRightColumn?: ReactNode;
  /** 是否显示对局计时与暂停（默认 true） */
  showTimer?: boolean;
  /** 填数/笔记等命令未改变盘面时回调（如非法操作） */
  onPlayRejected?: () => void;
  /** 未选中格子时按下数字键 */
  onNeedCellSelection?: () => void;
};

function hintCellSet(h: HintResult | null): Set<string> {
  const s = new Set<string>();
  if (!h) {
    return s;
  }
  for (const x of h.cells) {
    s.add(`${x.r},${x.c}`);
  }
  return s;
}

function candidateHighlightMap(h: HintResult | null): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  if (!h?.highlightCandidates) {
    return m;
  }
  for (const e of h.highlightCandidates) {
    const key = `${e.r},${e.c}`;
    m.set(key, new Set(e.digits));
  }
  return m;
}

/** 与选中格同一行、列或 3×3 宫（含选中格自身） */
function isInSelectedRegion(r: number, c: number, selected: { r: number; c: number } | null): boolean {
  if (!selected) {
    return false;
  }
  if (r === selected.r || c === selected.c) {
    return true;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const sbr = Math.floor(selected.r / 3) * 3;
  const sbc = Math.floor(selected.c / 3) * 3;
  return br === sbr && bc === sbc;
}

/** HUD 与首屏工具条共用：触控高、圆角与焦点环与设计令牌一致 */
const hudBtnBase =
  "inline-flex min-h-[var(--s2-touch-min)] touch-manipulation items-center justify-center rounded-[var(--s2-r-lg)] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-card-muted)]";
const hudBtnSecondary = [
  hudBtnBase,
  "bg-[var(--s2-btn-secondary-bg)] text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40",
].join(" ");
const hudBtnHint = [
  hudBtnBase,
  "bg-[var(--s2-hint-btn-bg)] text-[var(--s2-hint-btn-text)] ring-1 ring-[var(--s2-hint-btn-ring)] hover:opacity-90 disabled:opacity-40",
].join(" ");

/** 桌面横屏 / 全屏：HUD 横排，避免挤占纵向空间（E2E 16:9 视口契约） */
const hudLandscape =
  "[@media(min-width:768px)_and_(orientation:landscape)]:flex-row [@media(min-width:768px)_and_(orientation:landscape)]:items-stretch [@media(min-width:768px)_and_(orientation:landscape)]:gap-3 [@media(min-width:768px)_and_(orientation:landscape)]:p-2 [@media(min-width:768px)_and_(orientation:landscape)]:[&_button]:min-h-[2.75rem] [@media(min-width:768px)_and_(orientation:landscape)]:[&_button]:py-1.5";
const hudHintSplitLandscape =
  "[@media(min-width:768px)_and_(orientation:landscape)]:w-[min(100%,22rem)] [@media(min-width:768px)_and_(orientation:landscape)]:shrink-0 [@media(min-width:768px)_and_(orientation:landscape)]:border-l [@media(min-width:768px)_and_(orientation:landscape)]:border-t-0 [@media(min-width:768px)_and_(orientation:landscape)]:border-[var(--s2-border)] [@media(min-width:768px)_and_(orientation:landscape)]:pl-3 [@media(min-width:768px)_and_(orientation:landscape)]:pt-0";
const timerSizeLandscape =
  "[@media(min-width:768px)_and_(orientation:landscape)]:text-lg [@media(min-width:768px)_and_(orientation:landscape)]:font-semibold";

/**
 * 无尽与专项等模式共用的 9×9 盘面：`GameState` 驱动、笔记/填数模式、提示高亮、撤销重做、计时与暂停。
 */
export function SudokuPlaySurface(props: SudokuPlaySurfaceProps): JSX.Element {
  const {
    gameState,
    onGameStateChange,
    disabled = false,
    boardTestId = "sudoku-board",
    clearCellTestId = "sudoku-clear-cell",
    extraRightColumn,
    showTimer = true,
    onPlayRejected,
    onNeedCellSelection,
  } = props;

  const {
    selected,
    paused,
    hint,
    canUndo,
    canRedo,
    elapsedSec,
    interactionLocked,
    actions,
  } = useSudoku2Game({
    gameState,
    onGameStateChange,
    disabled,
    onPlayRejected,
    onNeedCellSelection,
    showTimer,
  });

  const hintCells = useMemo(() => hintCellSet(hint), [hint]);
  const candHigh = useMemo(() => candidateHighlightMap(hint), [hint]);

  /** 选中格为已填数字时，用于同数字全局高亮（空格选中时为 null） */
  const focusDigit = useMemo(() => {
    if (!selected) {
      return null;
    }
    const fd = getEffectiveDigitAt(gameState, selected.r, selected.c);
    return fd !== EMPTY_CELL ? fd : null;
  }, [gameState, selected]);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const { isSupported, isFullscreen, toggle } = useFullscreen(surfaceRef);

  const hintUndoRedoToolbar = (
    <div
      className={[
        "grid w-full grid-cols-3 gap-2 sm:gap-3",
        isFullscreen ? "gap-1.5" : "",
        "[@media(min-width:768px)_and_(orientation:landscape)]:gap-1.5",
      ].join(" ")}
      role="toolbar"
      aria-label="提示与撤销"
    >
      <button
        type="button"
        className={hudBtnHint}
        data-testid="sudoku-hint"
        aria-label="请求提示"
        disabled={interactionLocked}
        onClick={() => actions.requestHint()}
      >
        提示
      </button>
      <button
        type="button"
        className={hudBtnSecondary}
        data-testid="sudoku-undo"
        aria-label="撤销一步"
        disabled={interactionLocked || !canUndo}
        onClick={() => actions.undo()}
      >
        撤销
      </button>
      <button
        type="button"
        className={hudBtnSecondary}
        data-testid="sudoku-redo"
        aria-label="重做一步"
        disabled={interactionLocked || !canRedo}
        onClick={() => actions.redo()}
      >
        重做
      </button>
    </div>
  );

  return (
    <div
      ref={surfaceRef}
      className={[
        "flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
        "[@media(min-width:768px)_and_(orientation:landscape)]:mx-auto [@media(min-width:768px)_and_(orientation:landscape)]:max-w-[min(1600px,100%)]",
        /* 全屏：铺满视口、四边安全区内边距；主内容区 flex-1 占满剩余高度以便棋盘按栏内空间放大 */
        "data-[fullscreen=true]:box-border data-[fullscreen=true]:min-h-[100dvh] data-[fullscreen=true]:max-h-[100dvh] data-[fullscreen=true]:w-full data-[fullscreen=true]:min-h-0 data-[fullscreen=true]:overflow-y-auto data-[fullscreen=true]:overflow-x-hidden",
        "data-[fullscreen=true]:pt-[calc(0.75rem+env(safe-area-inset-top,0px))] data-[fullscreen=true]:pr-[calc(0.75rem+env(safe-area-inset-right,0px))] data-[fullscreen=true]:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] data-[fullscreen=true]:pl-[calc(0.75rem+env(safe-area-inset-left,0px))]",
      ].join(" ")}
      data-fullscreen={isFullscreen ? "true" : "false"}
      data-testid="sudoku-play-surface-root"
    >
      {showTimer ? (
        <div
          className={[
            "flex rounded-[var(--s2-r-xl)] bg-[var(--s2-card-muted)] ring-1 ring-[var(--s2-btn-secondary-ring)]",
            isFullscreen ? "shrink-0" : "",
            isFullscreen
              ? "flex-row items-stretch gap-3 p-2 [&_button]:min-h-[2.75rem] [&_button]:py-1.5"
              : ["flex-col gap-3 p-3", hudLandscape].join(" "),
          ].join(" ")}
          data-testid="sudoku-timer-row"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-[var(--s2-text-subtle)]">用时</span>
              <span
                className={[
                  "tabular-nums font-semibold tracking-tight text-[var(--s2-timer-text)]",
                  isFullscreen ? "text-lg" : "text-xl",
                  isFullscreen ? "" : timerSizeLandscape,
                ].join(" ")}
                data-testid="sudoku-timer"
                aria-live="polite"
              >
                {elapsedSec} 秒
              </span>
            </div>
            <div
              className="flex w-full min-w-0 flex-[1_1_12rem] flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-none"
              role="toolbar"
              aria-label="暂停与全屏"
            >
              <button
                type="button"
                className={[hudBtnSecondary, "min-w-[5.5rem]"].join(" ")}
                data-testid="sudoku-pause"
                aria-pressed={paused}
                aria-label={paused ? "继续对局" : "暂停对局"}
                disabled={disabled}
                onClick={() => actions.togglePause()}
              >
                {paused ? "继续" : "暂停"}
              </button>
              {isSupported ? (
                <button
                  type="button"
                  className={[hudBtnSecondary, "min-w-[5.5rem] shrink-0"].join(" ")}
                  data-testid="sudoku-fullscreen-toggle"
                  aria-pressed={isFullscreen}
                  aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
                  disabled={disabled}
                  onClick={() => void toggle()}
                >
                  {isFullscreen ? "退出全屏" : "全屏"}
                </button>
              ) : null}
            </div>
          </div>
          </div>

          <div
            className={[
              "border-[var(--s2-border)]",
              isFullscreen
                ? "w-[min(100%,22rem)] shrink-0 border-l border-t-0 pl-3 pt-0"
                : ["border-t pt-3", hudHintSplitLandscape].join(" "),
            ].join(" ")}
          >
            {hintUndoRedoToolbar}
          </div>
        </div>
      ) : null}
      {!showTimer ? (
        <div
          className="flex flex-col gap-3 rounded-[var(--s2-r-xl)] bg-[var(--s2-card-muted)] p-3 ring-1 ring-[var(--s2-btn-secondary-ring)]"
          data-testid={isSupported ? "sudoku-fullscreen-row" : "sudoku-aux-hud"}
        >
          {isSupported ? (
            <div className="flex flex-wrap items-center justify-end gap-2" role="toolbar" aria-label="全屏">
              <button
                type="button"
                className={[hudBtnSecondary, "min-w-[5.5rem]"].join(" ")}
                data-testid="sudoku-fullscreen-toggle"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
                disabled={disabled}
                onClick={() => void toggle()}
              >
                {isFullscreen ? "退出全屏" : "全屏"}
              </button>
            </div>
          ) : null}
          <div className={isSupported ? "border-t border-[var(--s2-border)] pt-3" : undefined}>
            {hintUndoRedoToolbar}
          </div>
        </div>
      ) : null}

      <div
        className={[
          "flex w-full min-w-0 flex-col gap-3 md:flex-row md:justify-between md:gap-4 lg:gap-7 [@media(min-width:768px)_and_(orientation:landscape)]:lg:gap-9",
          /* 非全屏须 align-start，避免侧栏过高时把棋盘行纵向拉伸破坏 aspect-square */
          isFullscreen ? "min-h-0 flex-1 md:items-stretch" : "md:items-start",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex w-full min-w-0 justify-center md:mx-0 [@media(min-width:768px)_and_(orientation:landscape)]:min-w-0 [@media(min-width:768px)_and_(orientation:landscape)]:flex-1 [@media(min-width:768px)_and_(orientation:landscape)]:justify-center",
            isFullscreen
              ? "s2-board-area min-h-0 flex-1 items-center md:min-h-0 md:flex-[1.35_1_0%]"
              : "",
          ].join(" ")}
        >
          <div
            className={[
              "s2-play-board grid aspect-square w-full grid-cols-[repeat(9,minmax(0,1fr))] grid-rows-[repeat(9,minmax(0,1fr))] gap-px overflow-hidden rounded-[var(--s2-r-xl)] border border-[var(--s2-board-border)] bg-[var(--s2-board-outer-bg)] p-2",
            ].join(" ")}
            data-testid={boardTestId}
            role="grid"
            aria-label="数独棋盘"
          >
          {Array.from({ length: 81 }, (_, i) => {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const d = getEffectiveDigitAt(gameState, r, c);
            const isGiven = gameState.cells[r][c].given !== undefined;
            const isSel = selected?.r === r && selected?.c === c;
            const inRegion = isInSelectedRegion(r, c, selected);
            const isSameDigitPeer =
              focusDigit !== null && d !== EMPTY_CELL && d === focusDigit;
            const hintHere = hintCells.has(`${r},${c}`);
            const thickR = (c + 1) % 3 === 0 && c < 8;
            const thickB = (r + 1) % 3 === 0 && r < 8;
            const candSet = candHigh.get(`${r},${c}`);
            const cellBg = isGiven
              ? inRegion
                ? "bg-[var(--s2-cell-region-given-bg)] text-[var(--s2-cell-given-text)]"
                : "bg-[var(--s2-cell-given-bg)] text-[var(--s2-cell-given-text)]"
              : inRegion
                ? "bg-[var(--s2-cell-region-empty-bg)] text-[var(--s2-cell-fill-text)]"
                : "bg-[var(--s2-cell-empty-bg)] text-[var(--s2-cell-fill-text)]";
            const hintRing = hintHere
              ? isGiven
                ? inRegion
                  ? "ring-2 ring-[var(--s2-cell-hint-ring)] ring-offset-1 ring-offset-[var(--s2-cell-region-given-bg)]"
                  : "ring-2 ring-[var(--s2-cell-hint-ring)] ring-offset-1 ring-offset-[var(--s2-cell-given-bg)]"
                : inRegion
                  ? "ring-2 ring-[var(--s2-cell-hint-ring)] ring-offset-1 ring-offset-[var(--s2-cell-region-empty-bg)]"
                  : "ring-2 ring-[var(--s2-cell-hint-ring)] ring-offset-1 ring-offset-[var(--s2-cell-empty-bg)]"
              : "";
            const sameDigitInset = isSameDigitPeer
              ? "shadow-[inset_0_0_0_2px_var(--s2-cell-same-digit-ring)]"
              : "";
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={[
                  "relative flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center p-0.5 text-[clamp(0.95rem,3.6vmin,1.35rem)] font-semibold transition-none",
                  cellBg,
                  sameDigitInset,
                  isSel ? "z-[1] ring-2 ring-[var(--s2-cell-selected-ring)]" : "",
                  hintRing,
                  thickR ? "border-r-2 border-r-[var(--s2-border-strong)]" : "",
                  thickB ? "border-b-2 border-b-[var(--s2-border-strong)]" : "",
                ].join(" ")}
                data-testid={`sudoku-cell-${r}-${c}`}
                data-s2-empty={d === EMPTY_CELL ? "true" : undefined}
                data-s2-given={isGiven ? "true" : undefined}
                data-s2-in-region={inRegion ? "true" : undefined}
                data-s2-same-digit={isSameDigitPeer ? "true" : undefined}
                data-hint-cell={hintHere ? "true" : undefined}
                aria-label={`单元格 ${r + 1} 行 ${c + 1} 列`}
                disabled={interactionLocked}
                onClick={() => {
                  if (interactionLocked) {
                    return;
                  }
                  actions.selectCell({ r, c });
                }}
              >
                {d === EMPTY_CELL ? (
                  <span className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-3 gap-px px-px text-[clamp(8px,2.2vmin,12px)] font-normal leading-none">
                    {Array.from({ length: 9 }, (_, k) => {
                      const n = k + 1;
                      const has = gameState.cells[r][c].notes?.has(n) ?? false;
                      const hintCand = candSet?.has(n) === true;
                      const em = hintCand ? "font-semibold text-[var(--s2-cand-hint)]" : "";
                      return (
                        <span
                          key={n}
                          className={[
                            "inline-flex min-h-0 min-w-0 items-center justify-center leading-none",
                            has
                              ? "text-[var(--s2-cand-pip-on)]"
                              : "text-[var(--s2-cand-pip-muted)] opacity-40",
                            em,
                          ].join(" ")}
                          data-testid={
                            hintCand
                              ? `sudoku-hint-candidate-${r}-${c}-${n}`
                              : `sudoku-note-marker-${r}-${c}-${n}`
                          }
                          data-hint-candidate={hintCand ? "true" : undefined}
                          aria-hidden
                        >
                          {n}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span>{String(d)}</span>
                )}
              </button>
            );
          })}
          </div>
        </div>

        <div
          className={[
            "s2-play-sidebar flex w-full min-w-0 flex-col",
            isFullscreen
              ? "max-w-[min(100%,min(96vw,52rem))] min-h-0 shrink flex-1 justify-center gap-5 overflow-y-auto overscroll-y-contain py-2 sm:gap-6 sm:py-3 md:max-w-[min(100%,min(48vw,48rem))] md:flex-[0.95_1_20rem] lg:max-w-[min(100%,min(42vw,48rem))]"
              : "shrink-0 gap-4 md:max-w-md [@media(min-width:768px)_and_(orientation:landscape)]:min-w-[min(100%,280px)] [@media(min-width:768px)_and_(orientation:landscape)]:max-w-[min(100%,min(32rem,42vw))] [@media(min-width:1024px)_and_(orientation:landscape)]:max-w-[min(100%,min(36rem,44vw))]",
          ].join(" ")}
        >
          <div className={["flex flex-col gap-2", isFullscreen ? "shrink-0" : ""].join(" ")}>
            <div
              className={[
                "flex w-full overflow-hidden rounded-2xl bg-[var(--s2-card-muted)] p-1 ring-1 ring-[var(--s2-btn-secondary-ring)]",
                isFullscreen ? "p-1.5" : "",
              ].join(" ")}
              role="group"
              aria-label="填数与笔记模式"
            >
              <button
                type="button"
                className={[
                  "flex-1 touch-manipulation select-none rounded-[var(--s2-r-lg)] px-3 py-3 font-semibold transition-colors",
                  isFullscreen
                    ? "min-h-[clamp(3.5rem,min(10vmin,12vh),7rem)] text-[clamp(1.15rem,min(3.6vmin,4vh),2rem)]"
                    : "min-h-[52px] text-base [@media(min-width:768px)_and_(orientation:landscape)]:min-h-[clamp(3.35rem,min(9vmin,10vh),6.5rem)] [@media(min-width:768px)_and_(orientation:landscape)]:text-[clamp(1.1rem,min(3.2vmin,3.6vh),1.75rem)]",
                  gameState.mode === "fill"
                    ? "bg-[var(--s2-accent)] text-[var(--s2-on-accent)] shadow-sm"
                    : "text-[var(--s2-text-muted)] hover:bg-[var(--s2-btn-secondary-bg)]",
                ].join(" ")}
                data-testid="sudoku-mode-fill"
                aria-pressed={gameState.mode === "fill"}
                disabled={interactionLocked}
                onClick={() => actions.setMode("fill")}
              >
                填数
              </button>
              <button
                type="button"
                className={[
                  "flex-1 touch-manipulation select-none rounded-[var(--s2-r-lg)] px-3 py-3 font-semibold transition-colors",
                  isFullscreen
                    ? "min-h-[clamp(3.5rem,min(10vmin,12vh),7rem)] text-[clamp(1.15rem,min(3.6vmin,4vh),2rem)]"
                    : "min-h-[52px] text-base [@media(min-width:768px)_and_(orientation:landscape)]:min-h-[clamp(3.35rem,min(9vmin,10vh),6.5rem)] [@media(min-width:768px)_and_(orientation:landscape)]:text-[clamp(1.1rem,min(3.2vmin,3.6vh),1.75rem)]",
                  gameState.mode === "notes"
                    ? "bg-[var(--s2-accent)] text-[var(--s2-on-accent)] shadow-sm"
                    : "text-[var(--s2-text-muted)] hover:bg-[var(--s2-btn-secondary-bg)]",
                ].join(" ")}
                data-testid="sudoku-mode-notes"
                aria-pressed={gameState.mode === "notes"}
                disabled={interactionLocked}
                onClick={() => actions.setMode("notes")}
              >
                笔记
              </button>
            </div>
            <p
              className={[
                "text-center leading-snug text-[var(--s2-text-subtle)]",
                isFullscreen
                  ? "text-[clamp(0.85rem,min(2.4vmin,2.8vh),1.15rem)]"
                  : "text-xs [@media(min-width:768px)_and_(orientation:landscape)]:text-[clamp(0.8rem,min(2vmin,2.2vh),1.05rem)]",
              ].join(" ")}
              data-testid="sudoku-mode-hint"
              aria-live="polite"
            >
              {gameState.mode === "fill"
                ? "先选空格，再点数字填入"
                : "先选空格，再点数字切换笔记标记"}
            </p>
          </div>

          <div
            className={[
              "grid grid-cols-3 gap-3",
              /* 全屏：键钮为正方形（宽≈高），避免被 flex 行高拉成细长条 */
              isFullscreen
                ? "mx-auto w-full max-w-[min(100%,min(72vmin,44rem))] shrink-0 justify-items-stretch gap-[clamp(0.55rem,min(2.5vmin,3vw),1.35rem)]"
                : [
                    "mx-auto w-full max-w-[min(100%,min(92vw,22.5rem))] sm:max-w-[min(100%,min(90vw,26rem))]",
                    "[@media(min-width:768px)_and_(orientation:landscape)]:max-w-[min(100%,min(72vmin,44rem))] [@media(min-width:768px)_and_(orientation:landscape)]:gap-[clamp(0.5rem,min(2.4vmin,3vw),1.35rem)]",
                  ].join(" "),
            ].join(" ")}
            data-testid="sudoku-digit-pad"
            role="group"
            aria-label="数字 1 至 9"
          >
            {Array.from({ length: 9 }, (_, i) => {
              const n = i + 1;
              const isFocusDigitKey = focusDigit === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={[
                    "min-w-0 touch-manipulation select-none rounded-xl font-semibold transition-colors",
                    isFocusDigitKey
                      ? "bg-[var(--s2-accent)] text-[var(--s2-on-accent)] shadow-sm ring-2 ring-[var(--s2-focus-ring)] hover:opacity-95 disabled:opacity-85"
                      : "bg-[var(--s2-digit-pad-bg)] text-[var(--s2-digit-pad-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:opacity-90 disabled:opacity-40",
                    isFullscreen
                      ? "flex aspect-square w-full max-w-full items-center justify-center px-1 py-1 text-[clamp(1.35rem,min(7vmin,min(8vw,10vh)),3.75rem)] sm:rounded-2xl sm:px-2"
                      : [
                          "flex w-full min-h-[56px] items-center justify-center px-2 py-2 text-lg sm:min-h-[3.5rem] sm:text-xl max-md:min-h-[clamp(3.25rem,12vw,4.5rem)] max-md:text-[clamp(1.1rem,5.2vw,1.65rem)]",
                          "[@media(min-width:768px)_and_(orientation:landscape)]:aspect-square [@media(min-width:768px)_and_(orientation:landscape)]:min-h-0 [@media(min-width:768px)_and_(orientation:landscape)]:rounded-2xl [@media(min-width:768px)_and_(orientation:landscape)]:px-2 [@media(min-width:768px)_and_(orientation:landscape)]:py-2 [@media(min-width:768px)_and_(orientation:landscape)]:text-[clamp(1.3rem,min(6.8vmin,min(7.5vw,10vh)),3.75rem)]",
                        ].join(" "),
                  ].join(" ")}
                  data-testid={`digit-pad-${n}`}
                  data-s2-focus-digit={isFocusDigitKey ? "true" : undefined}
                  aria-pressed={isFocusDigitKey}
                  aria-label={`数字 ${n}`}
                  onClick={() => actions.digit(n)}
                  disabled={interactionLocked}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={[
              "w-full touch-manipulation rounded-xl bg-[var(--s2-btn-secondary-bg)] px-4 py-3 font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40",
              isFullscreen
                ? "min-h-[clamp(3.65rem,min(9vmin,10vh),7.5rem)] shrink-0 px-5 text-[clamp(1rem,min(3vmin,3.4vh),1.5rem)] sm:rounded-2xl sm:px-6"
                : "min-h-[52px] text-sm [@media(min-width:768px)_and_(orientation:landscape)]:min-h-[clamp(3.5rem,min(8.5vmin,9.5vh),7rem)] [@media(min-width:768px)_and_(orientation:landscape)]:px-6 [@media(min-width:768px)_and_(orientation:landscape)]:text-[clamp(0.98rem,min(2.9vmin,3.2vh),1.45rem)] [@media(min-width:768px)_and_(orientation:landscape)]:sm:rounded-2xl",
            ].join(" ")}
            onClick={() => actions.clear()}
            disabled={interactionLocked || !selected}
            data-testid={clearCellTestId}
          >
            清除所选格
          </button>

          {hint ? (
            <p
              className={["text-[var(--s2-hint-banner)]", isFullscreen ? "shrink-0 text-[clamp(0.65rem,min(1.8vmin,2vh),0.85rem)]" : "text-xs"].join(
                " ",
              )}
              data-testid="sudoku-hint-banner"
              aria-live="polite"
            >
              提示技巧：{techniqueIdToZh(hint.technique)}
            </p>
          ) : null}

          {extraRightColumn ? (
            <div
              className={[
                "s2-play-sidebar-extra-actions flex flex-col gap-2",
                isFullscreen ? "shrink-0 gap-3 sm:gap-4" : "",
              ].join(" ")}
            >
              {extraRightColumn}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

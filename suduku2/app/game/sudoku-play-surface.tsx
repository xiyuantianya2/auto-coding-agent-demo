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
        /* 全屏：铺满视口、四边安全区内边距，避免贴边裁切；内容过高时可纵向滚动 */
        "data-[fullscreen=true]:box-border data-[fullscreen=true]:min-h-[100dvh] data-[fullscreen=true]:max-h-[100dvh] data-[fullscreen=true]:w-full data-[fullscreen=true]:overflow-y-auto data-[fullscreen=true]:overflow-x-hidden",
        "data-[fullscreen=true]:pt-[calc(0.75rem+env(safe-area-inset-top,0px))] data-[fullscreen=true]:pr-[calc(0.75rem+env(safe-area-inset-right,0px))] data-[fullscreen=true]:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] data-[fullscreen=true]:pl-[calc(0.75rem+env(safe-area-inset-left,0px))]",
      ].join(" ")}
      data-fullscreen={isFullscreen ? "true" : "false"}
      data-testid="sudoku-play-surface-root"
    >
      {showTimer ? (
        <div
          className={[
            "flex rounded-[var(--s2-r-xl)] bg-[var(--s2-card-muted)] ring-1 ring-[var(--s2-btn-secondary-ring)]",
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

      <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-5 lg:gap-8 [@media(min-width:768px)_and_(orientation:landscape)]:lg:gap-10">
        <div className="mx-auto flex w-full min-w-0 justify-center md:mx-0 [@media(min-width:768px)_and_(orientation:landscape)]:min-w-0 [@media(min-width:768px)_and_(orientation:landscape)]:flex-1 [@media(min-width:768px)_and_(orientation:landscape)]:justify-center">
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
            const hintHere = hintCells.has(`${r},${c}`);
            const thickR = (c + 1) % 3 === 0 && c < 8;
            const thickB = (r + 1) % 3 === 0 && r < 8;
            const candSet = candHigh.get(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={[
                  "relative flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center p-0.5 text-[clamp(0.95rem,3.6vmin,1.35rem)] font-semibold",
                  isGiven
                    ? "bg-[var(--s2-cell-given-bg)] text-[var(--s2-cell-given-text)]"
                    : "bg-[var(--s2-cell-empty-bg)] text-[var(--s2-cell-fill-text)]",
                  isSel ? "z-[1] ring-2 ring-[var(--s2-cell-selected-ring)]" : "",
                  hintHere
                    ? "ring-2 ring-[var(--s2-cell-hint-ring)] ring-offset-1 ring-offset-[var(--s2-cell-empty-bg)]"
                    : "",
                  thickR ? "border-r-2 border-r-[var(--s2-border-strong)]" : "",
                  thickB ? "border-b-2 border-b-[var(--s2-border-strong)]" : "",
                ].join(" ")}
                data-testid={`sudoku-cell-${r}-${c}`}
                data-hint-cell={hintHere ? "true" : undefined}
                aria-label={`单元格 ${r + 1} 行 ${c + 1} 列`}
                disabled={interactionLocked || isGiven}
                onClick={() => {
                  if (interactionLocked) {
                    return;
                  }
                  if (isGiven) {
                    actions.selectCell(null);
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

        <div className="flex w-full min-w-0 shrink-0 flex-col gap-4 md:max-w-sm [@media(min-width:768px)_and_(orientation:landscape)]:min-w-[min(100%,280px)] [@media(min-width:768px)_and_(orientation:landscape)]:max-w-sm">
          <div className="flex flex-col gap-2">
            <div
              className="flex w-full overflow-hidden rounded-2xl bg-[var(--s2-card-muted)] p-1 ring-1 ring-[var(--s2-btn-secondary-ring)]"
              role="group"
              aria-label="填数与笔记模式"
            >
              <button
                type="button"
                className={[
                  "min-h-[52px] flex-1 touch-manipulation select-none rounded-[var(--s2-r-lg)] px-3 py-3 text-base font-semibold transition-colors",
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
                  "min-h-[52px] flex-1 touch-manipulation select-none rounded-[var(--s2-r-lg)] px-3 py-3 text-base font-semibold transition-colors",
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
              className="text-center text-xs leading-snug text-[var(--s2-text-subtle)]"
              data-testid="sudoku-mode-hint"
              aria-live="polite"
            >
              {gameState.mode === "fill"
                ? "先选空格，再点数字填入"
                : "先选空格，再点数字切换笔记标记"}
            </p>
          </div>

          <div
            className="grid grid-cols-3 gap-3"
            data-testid="sudoku-digit-pad"
            role="group"
            aria-label="数字 1 至 9"
          >
            {Array.from({ length: 9 }, (_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  type="button"
                  className="min-h-[56px] min-w-0 touch-manipulation select-none rounded-xl bg-[var(--s2-digit-pad-bg)] px-2 py-3 text-lg font-semibold text-[var(--s2-digit-pad-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:opacity-90 disabled:opacity-40"
                  data-testid={`digit-pad-${n}`}
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
            className="min-h-[52px] w-full touch-manipulation rounded-xl bg-[var(--s2-btn-secondary-bg)] px-4 py-3 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40"
            onClick={() => actions.clear()}
            disabled={interactionLocked || !selected}
            data-testid={clearCellTestId}
          >
            清除所选格
          </button>

          {hint ? (
            <p className="text-xs text-[var(--s2-hint-banner)]" data-testid="sudoku-hint-banner" aria-live="polite">
              提示技巧：{techniqueIdToZh(hint.technique)}
            </p>
          ) : null}

          {extraRightColumn ? <div className="flex flex-col gap-2">{extraRightColumn}</div> : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { JSX, ReactNode } from "react";
import { useMemo } from "react";

import { EMPTY_CELL, getEffectiveDigitAt, type GameState } from "@/lib/core";
import type { HintResult } from "@/lib/hint";

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

  return (
    <div className="flex flex-col gap-4 [@media(min-width:768px)_and_(orientation:landscape)]:mx-auto [@media(min-width:768px)_and_(orientation:landscape)]:max-w-[min(1600px,100%)]">
      {showTimer ? (
        <div
          className="flex flex-wrap items-center gap-3 text-sm text-[var(--s2-timer-text)]"
          data-testid="sudoku-timer-row"
        >
          <span data-testid="sudoku-timer" aria-live="polite">
            用时：{elapsedSec} 秒
          </span>
          <button
            type="button"
            className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px] min-w-[88px]"
            data-testid="sudoku-pause"
            aria-pressed={paused}
            aria-label={paused ? "继续" : "暂停"}
            disabled={disabled}
            onClick={() => actions.togglePause()}
          >
            {paused ? "继续" : "暂停"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6 [@media(min-width:768px)_and_(orientation:landscape)]:lg:gap-10">
        <div
          className="mx-auto grid aspect-square w-full max-w-[min(92vw,420px)] grid-cols-9 gap-px overflow-hidden rounded-xl border border-[var(--s2-board-border)] bg-[var(--s2-board-outer-bg)] p-2 [@media(min-width:768px)_and_(orientation:landscape)]:max-w-[min(88vmin,560px)] [@media(min-width:1024px)_and_(orientation:portrait)]:max-w-[min(92vw,480px)]"
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
                  "relative flex aspect-square min-h-[36px] min-w-[36px] flex-col items-center justify-center p-0.5 text-base font-semibold md:min-h-[44px] md:min-w-[44px] md:text-lg [@media(min-width:768px)_and_(orientation:landscape)]:min-h-[40px] [@media(min-width:768px)_and_(orientation:landscape)]:min-w-[40px]",
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
                  <span className="grid w-full grid-cols-3 gap-px px-0.5 text-[9px] font-normal leading-none md:text-[10px] [@media(min-width:768px)_and_(orientation:landscape)]:text-[11px]">
                    {Array.from({ length: 9 }, (_, k) => {
                      const n = k + 1;
                      const has = gameState.cells[r][c].notes?.has(n) ?? false;
                      const hintCand = candSet?.has(n) === true;
                      const em = hintCand ? "font-semibold text-[var(--s2-cand-hint)]" : "";
                      return (
                        <span
                          key={n}
                          className={[
                            "flex h-3 w-3 items-center justify-center md:h-3.5 md:w-3.5 [@media(min-width:768px)_and_(orientation:landscape)]:h-4 [@media(min-width:768px)_and_(orientation:landscape)]:w-4",
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

        <div className="flex w-full flex-col gap-3 md:max-w-xs [@media(min-width:768px)_and_(orientation:landscape)]:min-w-[min(100%,280px)] [@media(min-width:768px)_and_(orientation:landscape)]:max-w-sm">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-[var(--s2-btn-secondary-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px]"
              data-testid="sudoku-mode-fill"
              aria-pressed={gameState.mode === "fill"}
              disabled={interactionLocked}
              onClick={() => actions.setMode("fill")}
            >
              填数
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-[var(--s2-btn-secondary-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px]"
              data-testid="sudoku-mode-notes"
              aria-pressed={gameState.mode === "notes"}
              disabled={interactionLocked}
              onClick={() => actions.setMode("notes")}
            >
              笔记
            </button>
          </div>

          <div className="grid grid-cols-9 gap-2 md:grid-cols-3 [@media(min-width:768px)_and_(orientation:landscape)]:gap-3">
            {Array.from({ length: 9 }, (_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  type="button"
                  className="rounded-lg bg-[var(--s2-digit-pad-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-digit-pad-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:opacity-90 disabled:opacity-40 min-h-[44px]"
                  data-testid={`digit-pad-${n}`}
                  onClick={() => actions.digit(n)}
                  disabled={interactionLocked}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-semibold ring-1 min-h-[44px] bg-[var(--s2-hint-btn-bg)] text-[var(--s2-hint-btn-text)] ring-amber-700/40 hover:opacity-90 disabled:opacity-40"
              data-testid="sudoku-hint"
              disabled={interactionLocked}
              onClick={() => actions.requestHint()}
            >
              提示
            </button>
            <button
              type="button"
              className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px]"
              data-testid="sudoku-undo"
              disabled={interactionLocked || !canUndo}
              onClick={() => actions.undo()}
            >
              撤销
            </button>
            <button
              type="button"
              className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-3 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px]"
              data-testid="sudoku-redo"
              disabled={interactionLocked || !canRedo}
              onClick={() => actions.redo()}
            >
              重做
            </button>
          </div>

          <button
            type="button"
            className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-40 min-h-[44px]"
            onClick={() => actions.clear()}
            disabled={interactionLocked || !selected}
            data-testid={clearCellTestId}
          >
            清除所选格
          </button>

          {hint ? (
            <p className="text-xs text-[var(--s2-hint-banner)]" data-testid="sudoku-hint-banner" aria-live="polite">
              提示技巧：{hint.technique}
              {hint.messageKey ? `（${hint.messageKey}）` : ""}
            </p>
          ) : null}

          {extraRightColumn ? <div className="flex flex-col gap-2">{extraRightColumn}</div> : null}
        </div>
      </div>
    </div>
  );
}

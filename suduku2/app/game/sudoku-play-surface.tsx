"use client";

import type { JSX, ReactNode } from "react";

import { EMPTY_CELL, getEffectiveDigitAt, type GameState } from "@/lib/core";

export type SudokuPlaySurfaceProps = {
  gameState: GameState;
  selected: { r: number; c: number } | null;
  onSelectCell: (cell: { r: number; c: number } | null) => void;
  onDigit: (digit: number) => void;
  onClear: () => void;
  disabled?: boolean;
  boardTestId?: string;
  clearCellTestId?: string;
  /** 渲染在数字区与清除按钮下方（如无尽模式的保存草稿）。 */
  extraRightColumn?: ReactNode;
};

/**
 * 无尽与专项等模式共用的 9×9 盘面与数字输入区（仅展示与点击，不含业务状态机）。
 */
export function SudokuPlaySurface(props: SudokuPlaySurfaceProps): JSX.Element {
  const {
    gameState,
    selected,
    onSelectCell,
    onDigit,
    onClear,
    disabled = false,
    boardTestId = "sudoku-board",
    clearCellTestId = "sudoku-clear-cell",
    extraRightColumn,
  } = props;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div
        className="mx-auto grid aspect-square w-full max-w-[min(92vw,420px)] grid-cols-9 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-2"
        data-testid={boardTestId}
      >
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const d = getEffectiveDigitAt(gameState, r, c);
          const isGiven = gameState.cells[r][c].given !== undefined;
          const isSel = selected?.r === r && selected?.c === c;
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={[
                "flex aspect-square items-center justify-center text-base font-semibold md:text-lg",
                isGiven ? "bg-zinc-800 text-zinc-100" : "bg-zinc-950 text-emerald-200",
                isSel ? "ring-2 ring-emerald-400/80" : "",
              ].join(" ")}
              data-testid={`sudoku-cell-${r}-${c}`}
              aria-label={`单元格 ${r + 1}-${c + 1}`}
              onClick={() => {
                if (isGiven) {
                  onSelectCell(null);
                  return;
                }
                onSelectCell({ r, c });
              }}
            >
              {d === EMPTY_CELL ? "" : String(d)}
            </button>
          );
        })}
      </div>

      <div className="flex w-full flex-col gap-3 md:max-w-xs">
        <div className="grid grid-cols-9 gap-2 md:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 disabled:opacity-40"
                data-testid={`digit-pad-${n}`}
                onClick={() => onDigit(n)}
                disabled={disabled}
              >
                {n}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800 disabled:opacity-40"
          onClick={onClear}
          disabled={disabled || !selected}
          data-testid={clearCellTestId}
        >
          清除所选格
        </button>
        {extraRightColumn ? <div className="flex flex-col gap-2">{extraRightColumn}</div> : null}
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { ConnectablePair } from "@/lib/game/connectivity";
import type { Board, CellCoord } from "@/lib/game/types";

const PATTERN_LABELS = [
  "🍎",
  "🍊",
  "🍋",
  "🍇",
  "🍓",
  "🍒",
  "🥝",
  "🍑",
  "🍐",
  "🍉",
  "🫐",
  "🍌",
  "🥭",
  "🍍",
  "🥥",
  "🫛",
  "🥕",
  "🌽",
  "🫑",
  "🍆",
  "🥔",
  "🧅",
  "🥒",
  "🥬",
  "🥦",
  "🧄",
  "🫒",
  "🌶️",
  "🫚",
  "🫘",
] as const;

function patternEmoji(patternId: number): string {
  if (patternId <= 0) return "·";
  const i = (patternId - 1) % PATTERN_LABELS.length;
  return PATTERN_LABELS[i] ?? String(patternId);
}

export type BoardGridProps = {
  board: Board;
  selected: CellCoord | null;
  /** 提示高亮的一对格子（与选中态可同时存在；选中格仍用选中样式）。 */
  hintPair?: ConnectablePair | null;
  won: boolean;
  onCellClick: (coord: CellCoord) => void;
};

function coordEq(p: CellCoord, q: CellCoord): boolean {
  return p.row === q.row && p.col === q.col;
}

/**
 * Responsive tile grid: on narrow viewports the outer wrapper scrolls; cell size scales down via CSS variables.
 */
export function BoardGrid({
  board,
  selected,
  hintPair = null,
  won,
  onCellClick,
}: BoardGridProps) {
  return (
    <div className="w-full max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-zinc-800/90 bg-zinc-950/40 [-webkit-overflow-scrolling:touch]">
      <div className="inline-block min-w-min p-2 sm:p-3">
        <div
          className={cn(
            "inline-grid gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-2 shadow-inner shadow-black/30 sm:gap-1.5 sm:p-3",
            "[--cell:1.6rem] [--emoji:text-base] sm:[--cell:2rem] sm:[--emoji:text-lg] md:[--cell:2.65rem] md:[--emoji:text-xl]",
          )}
          style={{
            gridTemplateColumns: `repeat(${board.cols}, minmax(0, var(--cell)))`,
          }}
        >
          {board.cells.map((row, r) =>
            row.map((cell, c) => {
              const coord = { row: r, col: c };
              const empty = cell === null;
              const isSel =
                selected?.row === r && selected?.col === c && cell !== null;
              const isHint =
                !empty &&
                hintPair !== null &&
                (coordEq(coord, hintPair.a) || coordEq(coord, hintPair.b));
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={empty || won}
                  onClick={() => onCellClick({ row: r, col: c })}
                  className={cn(
                    "flex aspect-square min-h-[var(--cell)] min-w-[var(--cell)] items-center justify-center rounded-lg transition-[transform,box-shadow,background-color] duration-150 [font-size:var(--emoji)]",
                    empty && "cursor-default bg-zinc-950/60 opacity-40",
                    !empty &&
                      !won &&
                      "bg-gradient-to-b from-zinc-700/90 to-zinc-800/95 hover:from-zinc-600 hover:to-zinc-700 active:scale-[0.97]",
                    isHint &&
                      !isSel &&
                      "z-[5] scale-[1.02] bg-gradient-to-b from-amber-900/90 to-amber-950/95 shadow-[0_0_0_2px_theme(colors.amber.400),0_0_0_4px_theme(colors.zinc.900)]",
                    isSel &&
                      "z-10 scale-[1.03] bg-gradient-to-b from-emerald-900/90 to-emerald-950/95 shadow-[0_0_0_2px_theme(colors.emerald.400),0_0_0_4px_theme(colors.zinc.900)]",
                    won && !empty && "opacity-55",
                  )}
                  aria-pressed={isSel}
                  aria-label={
                    empty
                      ? `空位 ${r + 1},${c + 1}`
                      : `棋子 ${r + 1},${c + 1}，图案 ${cell}`
                  }
                >
                  {empty ? "" : patternEmoji(cell)}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

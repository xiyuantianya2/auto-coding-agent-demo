"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import {
  createInitialPlayState,
  handleCellClick,
  restartPlayState,
} from "@/lib/game/game-state";
import { getLevelById } from "@/lib/game/levels";
import type { CellCoord } from "@/lib/game/types";

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

type LinkGameProps = {
  levelId?: number;
};

export function LinkGame({ levelId = 1 }: LinkGameProps) {
  const level = getLevelById(levelId);
  if (!level) {
    throw new Error(`LinkGame: unknown level id ${levelId}`);
  }

  const [state, setState] = useState(() => createInitialPlayState(level));

  const onCellClick = useCallback((coord: CellCoord) => {
    setState((s) => handleCellClick(s, coord));
  }, []);

  const onRestart = useCallback(() => {
    setState((s) => restartPlayState(s));
  }, []);

  const { board, selected, won } = state;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400">
        <span>
          关卡：<span className="text-zinc-200">{level.name}</span>
        </span>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-zinc-600 bg-zinc-900 px-4 py-1.5 text-zinc-200 hover:bg-zinc-800"
        >
          重新开始本关
        </button>
      </div>

      <div
        className="inline-grid gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-lg shadow-black/40"
        style={{
          gridTemplateColumns: `repeat(${board.cols}, minmax(0, 2.75rem))`,
        }}
      >
        {board.cells.map((row, r) =>
          row.map((cell, c) => {
            const isSel =
              selected?.row === r && selected?.col === c && cell !== null;
            const empty = cell === null;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={empty || won}
                onClick={() => onCellClick({ row: r, col: c })}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors",
                  empty && "cursor-default bg-zinc-950/50 opacity-40",
                  !empty &&
                    !won &&
                    "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600",
                  isSel &&
                    "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-900",
                  won && !empty && "opacity-60",
                )}
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

      {won ? (
        <p
          className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-center text-emerald-200"
          role="status"
        >
          胜利：已全部消除。
        </p>
      ) : (
        <p className="max-w-md text-center text-sm text-zinc-500">
          第一次点击选中；第二次若图案相同且路径可连（≤2 拐弯）则消除，否则以第二次为新的选中。
          再点已选格子可取消。
        </p>
      )}
    </div>
  );
}

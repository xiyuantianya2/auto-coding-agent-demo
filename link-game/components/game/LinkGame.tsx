"use client";

import { useCallback, useState } from "react";

import { BoardGrid } from "@/components/game/BoardGrid";
import {
  createInitialPlayState,
  handleCellClick,
  restartPlayState,
} from "@/lib/game/game-state";
import { getLevelById } from "@/lib/game/levels";
import type { CellCoord } from "@/lib/game/types";

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
    <div className="flex w-full max-w-2xl flex-col items-stretch gap-6">
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
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="shrink-0 self-start rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 sm:self-center"
        >
          重新开始本关
        </button>
      </header>

      <BoardGrid
        board={board}
        selected={selected}
        won={won}
        onCellClick={onCellClick}
      />

      {won ? (
        <p
          className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-center text-emerald-200"
          role="status"
        >
          胜利：已全部消除。
        </p>
      ) : (
        <p className="max-w-md self-center text-center text-sm text-zinc-500">
          第一次点击选中；第二次若图案相同且路径可连（≤2 拐弯）则消除，否则以第二次为新的选中。
          再点已选格子可取消。
        </p>
      )}
    </div>
  );
}

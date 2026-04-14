"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  cloneGameState,
  getEffectiveDigitAt,
  serializeGameState,
  type GameState,
} from "@/lib/core";
import { getNextHint, type HintResult } from "@/lib/hint";
import {
  applyCommand,
  createUndoRedo,
  type NotesCommand,
  type UndoRedoApi,
} from "@/lib/notes";
import { computeCandidates, type CandidatesGrid } from "@/lib/solver";

import { useSudokuSessionTimer } from "@/app/game/use-sudoku-session-timer";

export type Sudoku2GameActions = {
  /** 选中可编辑格；点给定格会清空选中。 */
  selectCell: (cell: { r: number; c: number } | null) => void;
  /** 切换填数 / 笔记模式（受暂停与 disabled 约束）。 */
  setMode: (mode: "fill" | "notes") => void;
  /** 对当前选中格输入数字（填数或笔记）。 */
  digit: (n: number) => void;
  /** 清除当前格填数或笔记。 */
  clear: () => void;
  /** 请求一步提示（高亮，不自动填数）。 */
  requestHint: () => void;
  undo: () => void;
  redo: () => void;
  /** 切换暂停；暂停时冻结交互与计时。 */
  togglePause: () => void;
};

export type UseSudoku2GameParams = {
  gameState: GameState;
  onGameStateChange: (next: GameState) => void;
  disabled?: boolean;
  onPlayRejected?: () => void;
  onNeedCellSelection?: () => void;
  /** 是否展示并累计对局计时（默认 true）。为 false 时计时冻结在 0。 */
  showTimer?: boolean;
};

export type UseSudoku2GameResult = {
  state: GameState;
  selected: { r: number; c: number } | null;
  paused: boolean;
  hint: HintResult | null;
  canUndo: boolean;
  canRedo: boolean;
  candidates: CandidatesGrid;
  elapsedSec: number;
  interactionLocked: boolean;
  actions: Sudoku2GameActions;
};

/**
 * 将主棋盘交互与各 lib（core / solver / hint / notes）编排收口为单一 hook，
 * 供 `SudokuPlaySurface` 与对外 `useSudoku2Game` 导出复用。
 */
export function useSudoku2Game(params: UseSudoku2GameParams): UseSudoku2GameResult {
  const {
    gameState,
    onGameStateChange,
    disabled = false,
    onPlayRejected,
    onNeedCellSelection,
    showTimer = true,
  } = params;

  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState<HintResult | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const interactionLocked = disabled || paused;

  const elapsedSec = useSudokuSessionTimer(showTimer ? paused : true);

  const candidates = useMemo(() => computeCandidates(gameState), [gameState]);

  const undoRedoRef = useRef<UndoRedoApi | null>(null);
  const gameStateRef = useRef(gameState);

  useLayoutEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const refreshUndoUi = useCallback(() => {
    const api = undoRedoRef.current;
    setCanUndo(api?.canUndo() ?? false);
    setCanRedo(api?.canRedo() ?? false);
  }, []);

  useEffect(() => {
    const api = createUndoRedo();
    undoRedoRef.current = api;
    api.push(cloneGameState(gameStateRef.current));
    queueMicrotask(() => {
      refreshUndoUi();
    });
  }, [refreshUndoUi]);

  const commit = useCallback(
    (next: GameState) => {
      const api = undoRedoRef.current;
      if (api) {
        api.push(cloneGameState(next));
      }
      onGameStateChange(next);
      setHint(null);
      refreshUndoUi();
    },
    [onGameStateChange, refreshUndoUi],
  );

  const apply = useCallback(
    (cmd: NotesCommand) => {
      if (interactionLocked) {
        return;
      }
      const next = applyCommand(gameState, cmd, candidates);
      if (serializeGameState(next) === serializeGameState(gameState)) {
        if (cmd.type === "fill" || cmd.type === "toggle") {
          onPlayRejected?.();
        }
        return;
      }
      commit(next);
    },
    [candidates, commit, gameState, interactionLocked, onPlayRejected],
  );

  const selectCell = useCallback(
    (cell: { r: number; c: number } | null) => {
      setSelected(cell);
    },
    [],
  );

  const setMode = useCallback(
    (mode: "fill" | "notes") => {
      if (interactionLocked || gameState.mode === mode) {
        return;
      }
      apply({ type: "setMode", payload: { mode } });
    },
    [apply, gameState.mode, interactionLocked],
  );

  const digit = useCallback(
    (n: number) => {
      if (interactionLocked) {
        return;
      }
      if (!selected) {
        onNeedCellSelection?.();
        return;
      }
      const { r, c } = selected;
      if (gameState.mode === "notes") {
        apply({ type: "toggle", payload: { r, c, digit: n } });
        return;
      }
      apply({ type: "fill", payload: { r, c, digit: n } });
    },
    [apply, gameState.mode, interactionLocked, onNeedCellSelection, selected],
  );

  const clear = useCallback(() => {
    if (interactionLocked || !selected) {
      return;
    }
    const { r, c } = selected;
    const cell = gameState.cells[r][c];
    if (cell.value !== undefined) {
      apply({ type: "clearCell", payload: { r, c } });
      return;
    }
    if (cell.notes && cell.notes.size > 0) {
      const next = cloneGameState(gameState);
      const cleared = { ...next.cells[r][c] };
      delete cleared.notes;
      next.cells[r][c] = cleared;
      next.grid[r][c] = getEffectiveDigitAt(next, r, c);
      commit(next);
    }
  }, [apply, commit, gameState, interactionLocked, selected]);

  const undo = useCallback(() => {
    if (interactionLocked) {
      return;
    }
    const api = undoRedoRef.current;
    if (!api?.canUndo()) {
      return;
    }
    const prev = applyCommand(
      gameState,
      { type: "undo", payload: api },
      candidates,
    );
    onGameStateChange(prev);
    setHint(null);
    refreshUndoUi();
  }, [candidates, gameState, interactionLocked, onGameStateChange, refreshUndoUi]);

  const redo = useCallback(() => {
    if (interactionLocked) {
      return;
    }
    const api = undoRedoRef.current;
    if (!api?.canRedo()) {
      return;
    }
    const next = applyCommand(
      gameState,
      { type: "redo", payload: api },
      candidates,
    );
    onGameStateChange(next);
    setHint(null);
    refreshUndoUi();
  }, [candidates, gameState, interactionLocked, onGameStateChange, refreshUndoUi]);

  const requestHint = useCallback(() => {
    if (interactionLocked) {
      return;
    }
    setHint(getNextHint(gameState));
  }, [gameState, interactionLocked]);

  const togglePause = useCallback(() => {
    if (disabled) {
      return;
    }
    setPaused((p) => !p);
  }, [disabled]);

  const actions = useMemo<Sudoku2GameActions>(
    () => ({
      selectCell,
      setMode,
      digit,
      clear,
      requestHint,
      undo,
      redo,
      togglePause,
    }),
    [clear, digit, redo, requestHint, selectCell, setMode, togglePause, undo],
  );

  return {
    state: gameState,
    selected,
    paused,
    hint,
    canUndo,
    canRedo,
    candidates,
    elapsedSec,
    interactionLocked,
    actions,
  };
}

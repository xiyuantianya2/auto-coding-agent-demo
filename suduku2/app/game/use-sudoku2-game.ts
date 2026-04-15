"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  cloneGameState,
  EMPTY_CELL,
  getEffectiveDigitAt,
  getUniqueValidPlacementDigit,
  serializeGameState,
  type GameState,
} from "@/lib/core";
import { getNextHint, type HintResult } from "@/lib/hint";
import {
  applyCommand,
  applyFullBoardPencilNotes,
  createUndoRedo,
  type NotesCommand,
  type UndoRedoApi,
} from "@/lib/notes";
import { computeCandidates, type CandidatesGrid } from "@/lib/solver";

import { useSudokuSessionTimer } from "@/app/game/use-sudoku-session-timer";

export type Sudoku2GameActions = {
  /** 选中格（含给定格，用于同数字高亮）；传 null 清除选中。 */
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
  /** 一键笔记：批量写入约束候选（任务 20）；经 `commit` 入撤销栈。 */
  fillAllPencilNotes: () => void;
};

export type UseSudoku2GameParams = {
  gameState: GameState;
  onGameStateChange: (next: GameState) => void;
  disabled?: boolean;
  onPlayRejected?: () => void;
  onNeedCellSelection?: () => void;
  /** 是否展示并累计对局计时（默认 true）。为 false 时计时冻结在 0。 */
  showTimer?: boolean;
  /**
   * 快速游戏：在**填数模式**下，首次点击某空格的瞬间若该行/列/宫约束下仅有一个合法数字则自动填入并走笔记同步。
   * **笔记模式**下不自动填数（仍只编辑笔记），优先级高于自动填数。
   */
  quickGameEnabled?: boolean;
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
    quickGameEnabled = false,
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
      if (cell === null) {
        setSelected(null);
        return;
      }
      if (interactionLocked) {
        return;
      }
      const { r, c } = cell;
      const isEmpty = getEffectiveDigitAt(gameState, r, c) === EMPTY_CELL;
      const isGiven = gameState.cells[r][c].given !== undefined;
      const wasSame = selected?.r === r && selected?.c === c;
      /** 空白格二次点击：在填数 / 笔记间切换（与工具栏一致，走同一 `setMode` 状态）。 */
      if (isEmpty && wasSame) {
        const nextMode = gameState.mode === "fill" ? "notes" : "fill";
        if (gameState.mode !== nextMode) {
          apply({ type: "setMode", payload: { mode: nextMode } });
        }
        return;
      }
      /**
       * 快速游戏：首次点到另一空格时尝试自动填数（`getUniqueValidPlacementDigit` 至多 9 次规则检查）。
       * 与笔记模式同时启用时：**仅填数模式**下才可能自动填；笔记模式下只选中格。
       */
      if (
        quickGameEnabled &&
        gameState.mode === "fill" &&
        isEmpty &&
        !isGiven &&
        !wasSame
      ) {
        const only = getUniqueValidPlacementDigit(gameState, r, c);
        if (only !== null) {
          apply({ type: "fill", payload: { r, c, digit: only } });
          setSelected({ r, c });
          return;
        }
      }
      setSelected({ r, c });
    },
    [apply, gameState, interactionLocked, quickGameEnabled, selected],
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
      if (gameState.cells[r][c].given !== undefined) {
        return;
      }
      if (gameState.mode === "notes") {
        apply({ type: "toggle", payload: { r, c, digit: n } });
        return;
      }
      apply({ type: "fill", payload: { r, c, digit: n } });
    },
    [apply, gameState.cells, gameState.mode, interactionLocked, onNeedCellSelection, selected],
  );

  const clear = useCallback(() => {
    if (interactionLocked || !selected) {
      return;
    }
    const { r, c } = selected;
    if (gameState.cells[r][c].given !== undefined) {
      return;
    }
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

  const fillAllPencilNotes = useCallback(() => {
    if (interactionLocked) {
      return;
    }
    const next = applyFullBoardPencilNotes(gameState);
    if (serializeGameState(next) === serializeGameState(gameState)) {
      return;
    }
    commit(next);
  }, [commit, gameState, interactionLocked]);

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
      fillAllPencilNotes,
    }),
    [clear, digit, fillAllPencilNotes, redo, requestHint, selectCell, setMode, togglePause, undo],
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

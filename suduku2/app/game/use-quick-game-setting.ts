"use client";

import { useCallback, useLayoutEffect, useState } from "react";

import { SUDOKU2_QUICK_GAME_STORAGE_KEY } from "@/app/ui-preferences";

function readQuickGameFromStorage(): boolean {
  try {
    return globalThis.localStorage?.getItem(SUDOKU2_QUICK_GAME_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 「快速游戏」开关：默认关闭，持久化到 `localStorage`（与主题等 UI 偏好一致）。
 */
export function useQuickGameSetting(): [boolean, (next: boolean) => void] {
  const [quickGame, setQuickGameState] = useState(false);

  useLayoutEffect(() => {
    const v = readQuickGameFromStorage();
    queueMicrotask(() => {
      setQuickGameState(v);
    });
  }, []);

  const setQuickGame = useCallback((next: boolean) => {
    setQuickGameState(next);
    try {
      if (next) {
        globalThis.localStorage?.setItem(SUDOKU2_QUICK_GAME_STORAGE_KEY, "1");
      } else {
        globalThis.localStorage?.removeItem(SUDOKU2_QUICK_GAME_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return [quickGame, setQuickGame];
}

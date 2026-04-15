"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { serializeGameState, type GameState } from "@/lib/core";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";

export type UseProgressDraftAutosaveOptions = {
  apiBaseUrl: string;
  token: string | null;
  enabled: boolean;
  gameState: GameState | null;
  /** 新对局/换题时变更，用于重置「已发送」快照（如 `${tier}-${seed}`）。 */
  autosaveKey: string;
  debounceMs?: number;
};

function wireDraftFromState(state: GameState): unknown {
  return JSON.parse(serializeGameState(state)) as unknown;
}

async function patchDraft(
  apiBaseUrl: string,
  token: string,
  draft: unknown,
): Promise<void> {
  const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress");
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ draft }),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

/**
 * 使用 `@/lib/core` `serializeGameState` 的 JSON 形状写入 `UserProgress.draft`（`PATCH /api/progress`）。
 * - 盘面变更防抖 PATCH；
 * - `pagehide`/`beforeunload` 尽力同步（`keepalive`）；
 * - `flushNow({ force: true })` 供「保存草稿」按钮立即落盘。
 */
export function useProgressDraftAutosave(options: UseProgressDraftAutosaveOptions): {
  flushNow: (opts?: { force?: boolean }) => Promise<void>;
} {
  const { apiBaseUrl, token, enabled, gameState, autosaveKey, debounceMs = 750 } = options;

  const lastSentRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const gameStateRef = useRef<GameState | null>(gameState);
  const enabledRef = useRef(enabled);
  const tokenRef = useRef(token);

  useLayoutEffect(() => {
    gameStateRef.current = gameState;
    enabledRef.current = enabled;
    tokenRef.current = token;
  }, [enabled, gameState, token]);

  const flushNow = useCallback(
    async (opts?: { force?: boolean }) => {
      const t = tokenRef.current;
      const gs = gameStateRef.current;
      if (!t || !gs || !enabledRef.current) {
        return;
      }
      const serialized = serializeGameState(gs);
      if (!opts?.force && lastSentRef.current === serialized) {
        return;
      }
      await patchDraft(apiBaseUrl, t, wireDraftFromState(gs));
      lastSentRef.current = serialized;
    },
    [apiBaseUrl],
  );

  /** 换题或新会话：立即同步草稿（`autosaveKey` 仅在换题/新局时变化）。 */
  useEffect(() => {
    lastSentRef.current = null;
    if (!enabledRef.current || !tokenRef.current || !gameStateRef.current) {
      return;
    }
    void flushNow({ force: true });
  }, [autosaveKey, flushNow]);

  useEffect(() => {
    if (!enabled || !token || !gameState) {
      if (timerRef.current !== null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current !== null) {
      globalThis.clearTimeout(timerRef.current);
    }
    timerRef.current = globalThis.setTimeout(() => {
      timerRef.current = null;
      void flushNow();
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        globalThis.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [debounceMs, enabled, flushNow, gameState, token]);

  useEffect(() => {
    const onLeave = () => {
      const t = tokenRef.current;
      const gs = gameStateRef.current;
      if (!t || !gs || !enabledRef.current) {
        return;
      }
      const wire = wireDraftFromState(gs);
      const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress");
      try {
        void fetch(url, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${t}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({ draft: wire }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };
    globalThis.addEventListener("pagehide", onLeave);
    globalThis.addEventListener("beforeunload", onLeave);
    return () => {
      globalThis.removeEventListener("pagehide", onLeave);
      globalThis.removeEventListener("beforeunload", onLeave);
    };
  }, [apiBaseUrl]);

  return { flushNow };
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * 向上计时的对局时钟：`paused` 为 true 时冻结显示与计时；恢复后继续累计。
 * 新一局请通过父级 `key` 重挂组件以归零。
 */
export function useSudokuSessionTimer(paused: boolean): number {
  const [elapsedSec, setElapsedSec] = useState(0);
  const anchorMsRef = useRef(0);
  const frozenSecRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    anchorMsRef.current = globalThis.Date.now();
    frozenSecRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (paused) {
      if (frozenSecRef.current === null) {
        const sec = Math.floor((globalThis.Date.now() - anchorMsRef.current) / 1000);
        frozenSecRef.current = sec;
        queueMicrotask(() => {
          setElapsedSec(sec);
        });
      }
      return;
    }
    if (frozenSecRef.current !== null) {
      anchorMsRef.current = globalThis.Date.now() - frozenSecRef.current * 1000;
      frozenSecRef.current = null;
    }
    const tick = () => {
      setElapsedSec(Math.floor((globalThis.Date.now() - anchorMsRef.current) / 1000));
    };
    tick();
    const id = globalThis.setInterval(tick, 500);
    return () => globalThis.clearInterval(id);
  }, [paused]);

  return elapsedSec;
}

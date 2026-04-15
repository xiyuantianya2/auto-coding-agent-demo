"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import {
  classifyFullscreenError,
  exitFullscreenFromDocument,
  getFullscreenChangeEventNames,
  isFullscreenApiSupported,
  isTargetFullscreen,
  requestFullscreenOnElement,
  type FullscreenActionResult,
  type FullscreenFailureKind,
} from "./fullscreen-dom";

const noopSubscribe = (): (() => void) => () => {};

function getIsSupportedClientSnapshot(): boolean {
  if (typeof globalThis.document === "undefined") return false;
  return isFullscreenApiSupported(globalThis.document);
}

export type UseFullscreenResult = {
  /** 当前文档是否提供任一 Fullscreen 入口（探测用 div） */
  isSupported: boolean;
  /** 当前全屏元素是否为 `targetRef` 指向的节点 */
  isFullscreen: boolean;
  /** 最近一次 enter/exit/toggle 的失败；成功时由调用方清除语义：成功不自动清空（见各方法） */
  lastError: { kind: FullscreenFailureKind; message?: string } | null;
  enter: () => Promise<FullscreenActionResult>;
  exit: () => Promise<FullscreenActionResult>;
  toggle: () => Promise<FullscreenActionResult>;
};

/**
 * 对目标容器封装全屏：进入 / 退出 / 切换，并监听 fullscreenchange 保持 `isFullscreen` 与 document 一致。
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>): UseFullscreenResult {
  const isSupported = useSyncExternalStore(noopSubscribe, getIsSupportedClientSnapshot, () => false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastError, setLastError] = useState<{ kind: FullscreenFailureKind; message?: string } | null>(
    null,
  );
  const syncFromDocument = useCallback(() => {
    const doc = globalThis.document;
    const target = targetRef.current;
    setIsFullscreen(isTargetFullscreen(doc, target));
  }, [targetRef]);

  useLayoutEffect(() => {
    const doc = globalThis.document;
    const names = getFullscreenChangeEventNames();
    for (const n of names) {
      doc.addEventListener(n, syncFromDocument);
    }
    return () => {
      for (const n of names) {
        doc.removeEventListener(n, syncFromDocument);
      }
    };
  }, [syncFromDocument]);

  /** ref 在子节点挂载后才有值，每帧对齐一次，避免仅靠事件漏掉初始态 */
  useLayoutEffect(() => {
    syncFromDocument();
  });

  const enter = useCallback(async (): Promise<FullscreenActionResult> => {
    const doc = globalThis.document;
    if (!isFullscreenApiSupported(doc)) {
      const err = { kind: "not_supported" as const, message: "Fullscreen API not supported" };
      setLastError(err);
      return { ok: false, ...err };
    }
    const el = targetRef.current;
    if (!el) {
      const err = { kind: "no_element" as const, message: "Target element is not mounted" };
      setLastError(err);
      return { ok: false, ...err };
    }
    try {
      await requestFullscreenOnElement(el);
      setLastError(null);
      return { ok: true };
    } catch (e) {
      const kind = classifyFullscreenError(e);
      const message = e instanceof Error ? e.message : String(e);
      setLastError({ kind, message });
      return { ok: false, kind, message };
    }
  }, [targetRef]);

  const exit = useCallback(async (): Promise<FullscreenActionResult> => {
    const doc = globalThis.document;
    if (!isFullscreenApiSupported(doc)) {
      const err = { kind: "not_supported" as const, message: "Fullscreen API not supported" };
      setLastError(err);
      return { ok: false, ...err };
    }
    try {
      await exitFullscreenFromDocument(doc);
      setLastError(null);
      return { ok: true };
    } catch (e) {
      const kind = classifyFullscreenError(e);
      const message = e instanceof Error ? e.message : String(e);
      setLastError({ kind, message });
      return { ok: false, kind, message };
    }
  }, []);

  const toggle = useCallback(async (): Promise<FullscreenActionResult> => {
    const doc = globalThis.document;
    const target = targetRef.current;
    const fs = isTargetFullscreen(doc, target);
    if (fs) {
      return exit();
    }
    return enter();
  }, [targetRef, enter, exit]);

  return useMemo(
    () => ({
      isSupported,
      isFullscreen,
      lastError,
      enter,
      exit,
      toggle,
    }),
    [isSupported, isFullscreen, lastError, enter, exit, toggle],
  );
}

"use client";

import { useRef } from "react";

import { useFullscreen } from "@/lib/fullscreen";

/**
 * 内部冒烟页：供任务 1 全屏 Hook 的 E2E 与人工验证，不作为主导航入口。
 */
export default function FullscreenSmokePage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isSupported, isFullscreen, lastError, enter, exit, toggle } = useFullscreen(rootRef);

  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col gap-4 p-8 text-[var(--s2-text)]"
      id="sudoku2-main"
    >
      <h1 className="text-xl font-semibold">全屏 API 冒烟</h1>
      <p className="text-sm text-[var(--s2-text-muted)]">
        用于验证 useFullscreen；正式对局 UI 将在后续任务接入。
      </p>

      <div
        ref={rootRef}
        className="rounded-lg border border-[var(--s2-nav-border)] bg-[var(--s2-page-bg)] p-6"
        data-fullscreen={isFullscreen ? "true" : "false"}
        data-supported={isSupported ? "true" : "false"}
        data-testid="fullscreen-smoke-root"
      >
        <p className="text-sm">此区域为全屏目标容器。</p>
      </div>

      <div
        aria-live="polite"
        className="text-sm"
        data-fullscreen={isFullscreen ? "true" : "false"}
        data-last-error-kind={lastError?.kind ?? ""}
        data-supported={isSupported ? "true" : "false"}
        data-testid="fullscreen-smoke-state"
      >
        <span>支持全屏：{isSupported ? "是" : "否"}</span>
        <span className="mx-2">·</span>
        <span>当前全屏：{isFullscreen ? "是" : "否"}</span>
        {lastError ? (
          <span className="block text-amber-700 dark:text-amber-300">
            最近错误：{lastError.kind}
            {lastError.message ? `（${lastError.message}）` : ""}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-emerald-600 px-3 py-1.5 text-sm text-emerald-800 dark:text-emerald-200"
          data-testid="fullscreen-smoke-enter"
          type="button"
          onClick={() => {
            void enter();
          }}
        >
          进入全屏
        </button>
        <button
          className="rounded border border-slate-500 px-3 py-1.5 text-sm"
          data-testid="fullscreen-smoke-exit"
          type="button"
          onClick={() => {
            void exit();
          }}
        >
          退出全屏
        </button>
        <button
          className="rounded border border-slate-500 px-3 py-1.5 text-sm"
          data-testid="fullscreen-smoke-toggle"
          type="button"
          onClick={() => {
            void toggle();
          }}
        >
          切换全屏
        </button>
      </div>
    </main>
  );
}

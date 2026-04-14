"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { useSudoku2Auth } from "@/app/auth-context";

export function GameGate(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  const { ready, token } = useSudoku2Auth();

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--s2-page-bg)] px-6 py-16 text-[var(--s2-text)]">
        <p className="text-sm text-[var(--s2-text-muted)]" data-testid="game-gate-loading">
          加载中…
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--s2-page-bg)] px-6 py-16 text-[var(--s2-text)]">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">对局</h1>
          <p
            className="mt-4 text-sm leading-relaxed text-[var(--s2-text-muted)]"
            data-testid="game-login-hint"
          >
            进入对局前请先登录账号，以便同步进度与无尽关卡数据。
          </p>
          <p className="mt-8">
            <Link
              href="/login"
              className="inline-flex rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              data-testid="game-goto-login"
            >
              去登录
            </Link>
          </p>
          <p className="mt-6">
            <Link
              href="/"
              className="text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400/90"
            >
              返回首页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

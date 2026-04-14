"use client";

import Link from "next/link";
import type { JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";

export function HomeSessionBar(): JSX.Element {
  const { ready, token, logout } = useSudoku2Auth();

  if (!ready) {
    return (
      <p className="text-sm text-zinc-500" data-testid="session-status">
        会话状态：加载中…
      </p>
    );
  }

  if (token) {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400"
        data-testid="session-status"
      >
        <span>已登录</span>
        <button
          type="button"
          className="rounded-md border border-zinc-600 px-3 py-1 text-zinc-200 transition hover:border-rose-500/60 hover:text-rose-200"
          onClick={() => logout()}
          data-testid="logout-button"
        >
          退出登录
        </button>
      </div>
    );
  }

  return (
    <p className="text-sm text-zinc-500" data-testid="session-status">
      未登录 —{" "}
      <Link href="/login" className="text-emerald-400 underline-offset-4 hover:underline">
        前往登录
      </Link>
    </p>
  );
}

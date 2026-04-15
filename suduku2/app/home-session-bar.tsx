"use client";

import Link from "next/link";
import type { JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";
import { sudoku2EntrySecondaryCtaClass } from "@/app/sudoku2-entry-shell";

export function HomeSessionBar(): JSX.Element {
  const { ready, token, logout } = useSudoku2Auth();

  if (!ready) {
    return (
      <p className="text-center text-sm text-[var(--s2-text-muted)]" data-testid="session-status">
        会话状态：加载中…
      </p>
    );
  }

  if (token) {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--s2-text-muted)]"
        data-testid="session-status"
      >
        <span className="font-medium text-[var(--s2-text)]">已登录</span>
        <button
          type="button"
          className={`${sudoku2EntrySecondaryCtaClass} px-4 text-[var(--s2-btn-secondary-text)]`}
          onClick={() => logout()}
          data-testid="logout-button"
        >
          退出登录
        </button>
      </div>
    );
  }

  return (
    <p className="text-center text-sm text-[var(--s2-text-muted)]" data-testid="session-status">
      未登录 —{" "}
      <Link
        href="/login"
        className="font-semibold text-[var(--s2-link)] underline-offset-4 hover:text-[var(--s2-link-hover)] hover:underline"
      >
        前往登录
      </Link>
    </p>
  );
}

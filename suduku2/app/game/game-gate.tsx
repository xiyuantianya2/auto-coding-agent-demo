"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { useSudoku2Auth } from "@/app/auth-context";
import {
  Sudoku2EntryCard,
  Sudoku2EntryScreen,
  Sudoku2EntryStack,
  sudoku2EntryPrimaryCtaClass,
  sudoku2EntryTextLinkClass,
} from "@/app/sudoku2-entry-shell";

export function GameGate(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  const { ready, token } = useSudoku2Auth();

  if (!ready) {
    return (
      <Sudoku2EntryScreen>
        <Sudoku2EntryStack>
          <p className="text-center text-sm text-[var(--s2-text-muted)]" data-testid="game-gate-loading">
            加载中…
          </p>
        </Sudoku2EntryStack>
      </Sudoku2EntryScreen>
    );
  }

  if (!token) {
    return (
      <Sudoku2EntryScreen>
        <Sudoku2EntryStack>
          <Sudoku2EntryCard>
            <h1 className="text-2xl font-semibold tracking-tight">对局</h1>
            <p className="mt-1 text-sm font-medium text-[var(--s2-text-muted)]">需要登录后继续</p>
            <p
              className="mt-4 text-sm leading-relaxed text-[var(--s2-text-muted)]"
              data-testid="game-login-hint"
            >
              进入对局前请先登录账号，以便同步进度与无尽关卡数据。
            </p>
            <p className="mt-8 flex justify-center">
              <Link
                href="/login"
                className={sudoku2EntryPrimaryCtaClass}
                data-testid="game-goto-login"
              >
                去登录
              </Link>
            </p>
            <p className="mt-8 text-center">
              <Link href="/" className={sudoku2EntryTextLinkClass}>
                返回首页
              </Link>
            </p>
          </Sudoku2EntryCard>
        </Sudoku2EntryStack>
      </Sudoku2EntryScreen>
    );
  }

  return <>{children}</>;
}

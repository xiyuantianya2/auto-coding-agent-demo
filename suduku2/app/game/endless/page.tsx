import Link from "next/link";

import {
  Sudoku2EntryScreen,
  Sudoku2EntryStack,
  sudoku2EntryTextLinkClass,
} from "@/app/sudoku2-entry-shell";
import { ENDLESS_TIER_LABEL_ZH, ENDLESS_TIER_ORDER } from "@/app/game/endless/endless-meta";

export default function EndlessIndexPage() {
  return (
    <Sudoku2EntryScreen>
      <Sudoku2EntryStack>
        <header className="rounded-[var(--s2-r-2xl)] border border-[var(--s2-accent-panel-border)] bg-[var(--s2-accent-panel-bg)] px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--s2-accent-panel-muted)]">
            无尽模式
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--s2-accent-panel-fg)]">
            选择难度
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--s2-accent-panel-muted)]">
            题目来自服务器共享题库与个人进度同步；客户端不会本地随机出题扩池。
          </p>
        </header>

        <ul
          className="mt-8 grid gap-3 sm:grid-cols-2 [@media(min-width:768px)_and_(orientation:landscape)]:grid-cols-4"
          data-testid="endless-tier-list"
        >
          {ENDLESS_TIER_ORDER.map((tier) => (
            <li key={tier}>
              <Link
                href={`/game/endless/${tier}`}
                className="flex min-h-[4.25rem] touch-manipulation items-center justify-between rounded-[var(--s2-r-xl)] border border-[var(--s2-border)] bg-[var(--s2-card)] px-5 py-4 text-sm font-semibold text-[var(--s2-text)] shadow-sm transition hover:border-[var(--s2-tier-hover-border)] hover:bg-[var(--s2-card-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-page-bg)]"
                data-testid={`endless-tier-${tier}`}
              >
                <span>{ENDLESS_TIER_LABEL_ZH[tier]}</span>
                <span className="text-xs font-medium text-[var(--s2-text-subtle)]">进入</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center">
          <Link className={sudoku2EntryTextLinkClass} href="/game">
            返回对局入口
          </Link>
        </p>
      </Sudoku2EntryStack>
    </Sudoku2EntryScreen>
  );
}

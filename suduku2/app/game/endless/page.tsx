import Link from "next/link";

import { ENDLESS_TIER_LABEL_ZH, ENDLESS_TIER_ORDER } from "@/app/game/endless/endless-meta";

export default function EndlessIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 text-[var(--s2-text)] md:px-6 md:py-12 [@media(min-width:768px)_and_(orientation:landscape)]:max-w-5xl">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--s2-eyebrow)]">无尽模式</p>
        <h1 className="mt-2 text-3xl font-semibold">选择难度</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--s2-text-muted)]">
          题目来自服务器共享题库与个人进度同步；客户端不会本地随机出题扩池。
        </p>
      </header>

      <ul
        className="grid gap-3 sm:grid-cols-2 [@media(min-width:768px)_and_(orientation:landscape)]:grid-cols-4"
        data-testid="endless-tier-list"
      >
        {ENDLESS_TIER_ORDER.map((tier) => (
          <li key={tier}>
            <Link
              href={`/game/endless/${tier}`}
              className="flex items-center justify-between rounded-[var(--s2-r-xl)] border border-[var(--s2-border)] bg-[var(--s2-card-muted)] px-5 py-4 text-sm font-semibold text-[var(--s2-text)] transition hover:border-[var(--s2-tier-hover-border)] hover:bg-[var(--s2-card)]"
              data-testid={`endless-tier-${tier}`}
            >
              <span>{ENDLESS_TIER_LABEL_ZH[tier]}</span>
              <span className="text-xs font-medium text-[var(--s2-text-subtle)]">进入</span>
            </Link>
          </li>
        ))}
      </ul>

      <p>
        <Link
          className="text-sm text-[var(--s2-link)] underline-offset-4 hover:text-[var(--s2-link-hover)] hover:underline"
          href="/game"
        >
          返回对局入口
        </Link>
      </p>
    </div>
  );
}

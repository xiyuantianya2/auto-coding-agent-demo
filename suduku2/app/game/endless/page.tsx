import Link from "next/link";

import { ENDLESS_TIER_LABEL_ZH, ENDLESS_TIER_ORDER } from "@/app/game/endless/endless-meta";

export default function EndlessIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 text-zinc-100">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">无尽模式</p>
        <h1 className="mt-2 text-3xl font-semibold">选择难度</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          题目来自服务器共享题库与个人进度同步；客户端不会本地随机出题扩池。
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2" data-testid="endless-tier-list">
        {ENDLESS_TIER_ORDER.map((tier) => (
          <li key={tier}>
            <Link
              href={`/game/endless/${tier}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-5 py-4 text-sm font-semibold text-zinc-100 transition hover:border-emerald-500/50 hover:bg-zinc-900"
              data-testid={`endless-tier-${tier}`}
            >
              <span>{ENDLESS_TIER_LABEL_ZH[tier]}</span>
              <span className="text-xs font-medium text-zinc-500">进入</span>
            </Link>
          </li>
        ))}
      </ul>

      <p>
        <Link className="text-sm text-emerald-400/90 underline-offset-4 hover:underline" href="/game">
          返回对局入口
        </Link>
      </p>
    </div>
  );
}

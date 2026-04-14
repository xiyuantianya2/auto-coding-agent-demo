import Link from "next/link";
import type { JSX } from "react";

export default function GamePage(): JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--s2-page-bg)] px-6 py-16 text-[var(--s2-text)]">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">对局</h1>
        <p className="mt-3 text-sm text-[var(--s2-text-muted)]">
          无尽模式从服务器题库选题并同步进度；主棋盘的高级交互将在后续任务继续完善。
        </p>
        <p className="mt-8">
          <Link
            href="/game/endless"
            className="inline-flex rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            data-testid="game-goto-endless"
          >
            无尽模式
          </Link>
        </p>
        <p className="mt-6">
          <Link href="/" className="text-emerald-700 dark:text-emerald-400 underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}

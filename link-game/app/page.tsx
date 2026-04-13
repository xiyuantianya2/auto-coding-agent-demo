import Link from "next/link";

import { LinkGame } from "@/components/game/LinkGame";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            link-game
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            连连看
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            客户端试玩（选子、消除与胜负）。更多玩法见仓库根目录{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
              task.json
            </code>
            。
          </p>
        </div>

        <LinkGame />

        <p>
          <Link
            href="/dev/agent"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-300/95 hover:bg-emerald-900/50"
          >
            一键全自动开发（Cursor CLI）
          </Link>
        </p>
      </main>
    </div>
  );
}

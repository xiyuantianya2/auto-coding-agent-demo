import Link from "next/link";
import { GameInstructionsDialog } from "@/components/GameInstructionsDialog";
import { SwapPlayground } from "@/components/SwapPlayground";

export default function Home() {
  return (
    <div className="flex min-h-full w-full min-w-0 flex-col items-center overflow-x-hidden bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <main className="flex w-full min-w-0 max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            duiduipeng
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            对对碰
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            相邻交换形成三消、对碰合并与下落补位；在固定步数内达成目标分。任务与验收见{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
              duiduipeng/task.json
            </code>
            。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <GameInstructionsDialog />
          <Link
            href="#duiduipeng-game-main"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-300/95 hover:bg-emerald-900/50"
          >
            前往游戏主区域
          </Link>
        </div>

        {/* 游戏主界面与棋盘；容器类名固定便于样式与测试定位 */}
        <section
          id="duiduipeng-game-main"
          className="duiduipeng-game-main w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left text-sm text-zinc-400 sm:p-8"
        >
          <p className="mb-6 text-center text-zinc-400">
            先点一格再点正交相邻格交换；仅当形成三消或对碰时消耗步数，非法交换会回滚并提示。开发服务器默认端口{" "}
            <span className="font-mono text-zinc-200">3001</span>（与连连看{" "}
            <span className="font-mono text-zinc-200">3000</span> 错开）。
          </p>
          <SwapPlayground />
        </section>
      </main>
    </div>
  );
}

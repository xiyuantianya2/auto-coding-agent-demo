export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            duiduipeng
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            对对碰
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            脚手架已就绪。核心玩法（相邻交换三消、对碰合并、下落补位）与任务清单见{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
              duiduipeng/task.json
            </code>
            。
          </p>
        </div>

        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          游戏棋盘与逻辑将在后续任务中接入；开发服务器默认端口{" "}
          <span className="font-mono text-zinc-200">3001</span>（与连连看
          <span className="font-mono text-zinc-200"> 3000 </span>
          错开）。
        </div>
      </main>
    </div>
  );
}

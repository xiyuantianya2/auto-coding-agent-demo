import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <main className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          suduku
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          数独
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          项目已重置为干净起点。请在本机启动{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            tools/auto-coding-agent
          </code>{" "}
          后，从本项目的{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            task.json
          </code>{" "}
          第 1 条任务起推进。
        </p>
        <p className="mt-8">
          <Link
            href="http://127.0.0.1:3910/agent.html?project=suduku"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-300/95 hover:bg-emerald-900/50"
          >
            一键全自动开发（面板）
          </Link>
        </p>
      </main>
    </div>
  );
}

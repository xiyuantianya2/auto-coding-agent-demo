"use client";

import { useCallback, useEffect, useState } from "react";

type StatusPayload =
  | {
      ok: true;
      repoRoot: string;
      project: string;
      description: string;
      stats: { total: number; done: number; remaining: number };
      nextTask: { id: number; title: string } | null;
      pendingTitles: { id: number; title: string }[];
      progressTail: string;
      progressTruncated: boolean;
      hasProgressFile: boolean;
    }
  | { ok: false; error: string };

const CODING_PROMPT = `【全自动编程 Agent · Coding 会话】
请严格按本仓库根目录下的 CLAUDE.md 执行（不要用 INITIALIZER.md 作为主流程）。

会话开头顺序（Step 1）：pwd → 读取 progress.txt → 读取 task.json → git log --oneline -20 → 阅读并执行 ./init.sh → 浏览器基线冒烟。基线未确认前不要开始新功能。

然后：在 task.json 中选一个 passes 为 false 的任务，完成实现、测试、更新 progress.txt、与 task.json 同一 commit。

仓库根目录与 hello-nextjs 目录同级；应用在 hello-nextjs 内。`;

const INIT_PROMPT = `【全自动编程 Agent · Initializer 首轮】
请只按本仓库根目录下的 INITIALIZER.md 执行首轮初始化：根据 architecture.md 生成或补全 task.json、校验 init.sh、写入 progress.txt 首条记录、初始 commit。不要连续实现多个业务功能。

完成后，后续会话改用 CLAUDE.md。`;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AgentConsole() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/status", { cache: "no-store" });
      const json = (await res.json()) as StatusPayload;
      setData(json);
    } catch {
      setData({ ok: false, error: "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCopy = async (label: string, text: string) => {
    const ok = await copyText(text);
    setCopyHint(ok ? `已复制：${label}` : "复制失败，请手动选择文本");
    setTimeout(() => setCopyHint(null), 2500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          全自动编程 Agent 控制台
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          在网页中查看任务清单与进度，并把提示词复制到 Cursor / Claude Code
          中使用。实际执行 Agent 仍在本地 CLI 或 IDE 内完成。
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        <p className="font-medium">说明</p>
        <p className="mt-1 text-amber-200/70">
          本页通过服务端读取与 <code className="rounded bg-zinc-800 px-1">hello-nextjs</code>{" "}
          同级目录中的 <code className="rounded bg-zinc-800 px-1">task.json</code>{" "}
          / <code className="rounded bg-zinc-800 px-1">progress.txt</code>
          。若部署到仅含子目录的环境，需设置环境变量{" "}
          <code className="rounded bg-zinc-800 px-1">AUTOMATION_REPO_ROOT</code>。
        </p>
      </div>

      {copyHint && (
        <p className="text-sm text-emerald-400" role="status">
          {copyHint}
        </p>
      )}

      {loading && (
        <p className="text-sm text-zinc-500">加载中…</p>
      )}

      {!loading && data && !data.ok && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {data.error}
        </div>
      )}

      {!loading && data && data.ok && (
        <>
          <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              仓库与项目
            </h2>
            <p className="text-xs text-zinc-500">根目录（解析结果）</p>
            <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-300">
              {data.repoRoot}
            </pre>
            <p className="text-lg font-medium text-zinc-100">{data.project}</p>
            <p className="text-sm text-zinc-400">{data.description}</p>
            <div className="flex flex-wrap gap-4 pt-2 text-sm">
              <span className="text-zinc-400">
                总任务 <strong className="text-zinc-100">{data.stats.total}</strong>
              </span>
              <span className="text-zinc-400">
                已完成{" "}
                <strong className="text-emerald-400">{data.stats.done}</strong>
              </span>
              <span className="text-zinc-400">
                未完成{" "}
                <strong className="text-amber-400">{data.stats.remaining}</strong>
              </span>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              建议下一任务
            </h2>
            {data.nextTask ? (
              <p className="text-zinc-100">
                <span className="text-zinc-500">#{data.nextTask.id}</span>{" "}
                {data.nextTask.title}
              </p>
            ) : (
              <p className="text-emerald-400/90">全部任务已为完成状态。</p>
            )}
            {data.pendingTitles.length > 1 && (
              <ul className="list-inside list-disc text-sm text-zinc-500">
                {data.pendingTitles.slice(1).map((t) => (
                  <li key={t.id}>
                    #{t.id} {t.title}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              复制提示词（到 Claude Code / Cursor）
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onCopy("Coding 会话", CODING_PROMPT)}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white"
              >
                复制 · Coding 会话（CLAUDE.md）
              </button>
              <button
                type="button"
                onClick={() => void onCopy("Initializer 首轮", INIT_PROMPT)}
                className="rounded-lg border border-zinc-600 bg-transparent px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                复制 · Initializer 首轮（INITIALIZER.md）
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800"
              >
                刷新数据
              </button>
            </div>
            <details className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-500">
              <summary className="cursor-pointer text-zinc-400">
                预览 Coding 提示词全文
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-zinc-400">
                {CODING_PROMPT}
              </pre>
            </details>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              progress.txt（尾部）
              {data.progressTruncated && (
                <span className="ml-2 font-normal text-amber-500/90">
                  已截断，仅显示末尾一段
                </span>
              )}
            </h2>
            {!data.hasProgressFile && (
              <p className="text-sm text-zinc-500">未找到 progress.txt</p>
            )}
            {data.hasProgressFile && (
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-400">
                {data.progressTail || "（空文件）"}
              </pre>
            )}
          </section>
        </>
      )}
    </div>
  );
}

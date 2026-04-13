"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function getAgentBase(): string {
  return (process.env.NEXT_PUBLIC_AUTO_AGENT_BASE || "http://127.0.0.1:3910").replace(
    /\/$/,
    "",
  );
}

type StatusPayload = {
  ok?: boolean;
  pendingCount?: number;
  nextTask?: { id: number; title: string } | null;
  status?: string;
  lastError?: string | null;
  recentLog?: string[];
  error?: string;
};

export default function AgentPanelPage() {
  const base = getAgentBase();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${base}/api/status`, { cache: "no-store" });
      const d = (await r.json()) as StatusPayload;
      if (!d.ok) throw new Error(d.error || "status failed");
      setData(d);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    }
  }, [base]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  async function postControl(action: "start" | "pause" | "reset") {
    setBusy(true);
    try {
      const r = await fetch(`${base}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!d.ok) {
        window.alert(d.error || "操作失败");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const st = data?.status;
  const running = st === "running";
  const pending = data?.pendingCount ?? 0;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-12 text-zinc-100">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          link-game
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">全自动开发</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          先在终端启动本地面板服务（仓库{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
            tools/auto-coding-agent
          </code>
          ），再点击下方按钮。会按根目录{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
            task.json
          </code>{" "}
          中未完成项依次调用本机{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
            agent
          </code>{" "}
          CLI，需已执行{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">
            agent login
          </code>
          。
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          面板地址（可改环境变量{" "}
          <code className="text-zinc-400">NEXT_PUBLIC_AUTO_AGENT_BASE</code>）：{" "}
          <span className="text-zinc-300">{base}</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || running || pending === 0}
          onClick={() => {
            if (pending === 0) return;
            void postControl("start");
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          一键开始全自动开发
        </button>
        <button
          type="button"
          disabled={busy || !running}
          onClick={() => void postControl("pause")}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          暂停
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("确定重置面板状态？不会撤销已写代码。")) void postControl("reset");
          }}
          className="rounded-lg border border-red-900/60 bg-zinc-900 px-4 py-2 text-sm text-red-200 hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          重置状态
        </button>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-300">状态</h2>
        {err ? (
          <p className="mt-2 text-sm text-amber-400">
            无法连接面板：{err}
            <br />
            <span className="text-zinc-500">
              请在仓库根目录进入 tools/auto-coding-agent 后执行 npm start
            </span>
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-400">
            <li>
              运行状态：<span className="text-zinc-100">{st ?? "—"}</span>
            </li>
            <li>
              待办任务数：<span className="text-zinc-100">{pending}</span>
            </li>
            <li>
              下一项：
              <span className="text-zinc-100">
                {data?.nextTask
                  ? `#${data.nextTask.id} ${data.nextTask.title}`
                  : "（无）"}
              </span>
            </li>
          </ul>
        )}
        {data?.lastError ? (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-red-950/40 p-3 text-xs text-red-200">
            {data.lastError}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-medium text-zinc-400">最近日志</h2>
        <pre className="mt-2 max-h-64 overflow-auto text-xs leading-relaxed text-zinc-500">
          {(data?.recentLog || []).join("") || "（无）"}
        </pre>
      </section>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/" className="text-emerald-500/90 hover:underline">
          返回首页
        </Link>
        {" · "}
        <a
          href={`${base}/`}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-500/90 hover:underline"
        >
          在独立标签页打开原生面板
        </a>
      </p>
    </div>
  );
}

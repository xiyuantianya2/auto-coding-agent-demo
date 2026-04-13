"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  formatApiTimeForDisplay,
  rewriteRecentLogLinesToBeijing,
} from "@/lib/beijing-display";
import { PANEL_DISPLAY_MAX_LINES, takeLastLines } from "@/lib/last-lines";

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
  agentPrompt?: string | null;
  agentPromptTaskId?: number | null;
  agentPromptUpdatedAt?: string | null;
  agentCliText?: string | null;
  agentCliTaskId?: number | null;
  agentCliUpdatedAt?: string | null;
  agentCliMaxChars?: number;
  autoAdvance?: boolean;
  agentWaitingForInput?: boolean;
  agentStdinAvailable?: boolean;
  pausedHelp?: string | null;
  error?: string;
};

export default function AgentPanelPage() {
  const base = getAgentBase();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const cliOutRef = useRef<HTMLPreElement>(null);

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
    const t = setInterval(() => void load(), 1000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (data?.status === "running" && cliOutRef.current) {
      cliOutRef.current.scrollTop = cliOutRef.current.scrollHeight;
    }
  }, [data?.status, data?.agentCliText]);

  async function postControl(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`${base}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
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

  const fullPrompt = data?.agentPrompt?.trim() ? data.agentPrompt : "";
  const fullCli = data?.agentCliText?.trim() ? data.agentCliText : "";
  const fullRunLog = rewriteRecentLogLinesToBeijing((data?.recentLog ?? []).join(""));

  const displayPrompt = fullPrompt
    ? takeLastLines(fullPrompt, PANEL_DISPLAY_MAX_LINES)
    : "";
  const displayCli = fullCli ? takeLastLines(fullCli, PANEL_DISPLAY_MAX_LINES) : "";
  const displayRunLog = fullRunLog
    ? takeLastLines(fullRunLog, PANEL_DISPLAY_MAX_LINES)
    : "";

  const lineCount = (s: string) => (s ? s.split(/\r?\n/).length : 0);

  async function copyFull(key: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      window.alert("复制失败，请检查浏览器权限。");
    }
  }

  async function sendInput() {
    const text = inputText.trim();
    if (!text) return;
    setSending(true);
    try {
      const r = await fetch(`${base}/api/agent-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!d.ok) {
        window.alert(d.error || "发送失败");
        return;
      }
      setInputText("");
    } catch {
      window.alert("发送失败，请检查网络连接。");
    } finally {
      setSending(false);
    }
    await load();
  }

  const showInput = running && !!data?.agentStdinAvailable;
  const waitingForInput = !!data?.agentWaitingForInput;

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-6 py-12 text-zinc-100">
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
        <p className="mt-2 text-xs text-zinc-500">
          提示词与「CLI 实时输出」在中等宽度以上<strong>左右并排</strong>；窗口较窄时会上下排列，请向下滚动。若看不到右栏，请重启{" "}
          <code className="text-zinc-400">tools/auto-coding-agent</code> 并对本页 <strong>Ctrl+F5</strong>。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || running || pending === 0}
          onClick={() => {
            if (pending === 0) return;
            void postControl("start");
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {st === "idle" && pending > 0 ? "开始下一任务" : "开始全自动"}
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
        <button
          type="button"
          disabled={busy}
          title="task.json 全 false、删 lib/game、恢复首页、写 progress，并清空面板"
          onClick={() => {
            if (
              window.confirm(
                "将执行：task.json 全部 passes 置为 false；删除 link-game/lib/game（若存在）；首页恢复为占位；progress.txt 追加记录；并终止 agent、清空面板（与「重置状态」相同）。已实现的连连看代码将丢失。确定？",
              )
            )
              void postControl("reset-link-game");
          }}
          className="rounded-lg border border-amber-800/70 bg-amber-950/50 px-4 py-2 text-sm text-amber-100 hover:border-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          清理连连看项目
        </button>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-zinc-500 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={data?.autoAdvance ?? true}
            onChange={(e) => void postControl("set-auto-advance", { value: e.target.checked })}
            className="accent-emerald-500"
          />
          自动推进（任务完成后自动开始下一个）
        </label>
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
        {data?.status === "paused" && data?.pausedHelp ? (
          <p className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/50 p-3 text-xs leading-relaxed text-amber-100">
            {data.pausedHelp}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex min-h-[12rem] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-300">提交给 Cursor CLI 的提示词</h2>
            <button
              type="button"
              disabled={!fullPrompt}
              onClick={() => void copyFull("prompt", fullPrompt)}
              className="shrink-0 rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiedKey === "prompt" ? "已复制" : "复制全文"}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {data?.agentPrompt && String(data.agentPrompt).trim()
              ? `task id=${data.agentPromptTaskId ?? "—"}${data.agentPromptUpdatedAt ? ` · ${formatApiTimeForDisplay(data.agentPromptUpdatedAt)}` : ""}${lineCount(fullPrompt) > PANEL_DISPLAY_MAX_LINES ? ` · 面板显示末尾 ${PANEL_DISPLAY_MAX_LINES} 行` : ""}`
              : "—"}
          </p>
          <pre className="mt-2 min-h-0 flex-1 max-h-[min(52vh,28rem)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-sky-200/95">
            {displayPrompt || "（尚无：开始任务后将显示与 agent 进程相同的完整提示文本）"}
          </pre>
        </section>

        <section className="flex min-h-[12rem] flex-col rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-medium text-emerald-200/90">Cursor CLI 实时输出</h2>
            <button
              type="button"
              disabled={!fullCli}
              onClick={() => void copyFull("cli", fullCli)}
              className="shrink-0 rounded-md border border-emerald-700/60 bg-emerald-950/80 px-2.5 py-1 text-xs text-emerald-100 hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiedKey === "cli" ? "已复制" : "复制全文"}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {data?.agentCliText && String(data.agentCliText).trim()
              ? `task id=${data.agentCliTaskId ?? "—"}${data.agentCliUpdatedAt ? ` · ${formatApiTimeForDisplay(data.agentCliUpdatedAt)}` : ""}${data.agentCliMaxChars ? ` · 最长约 ${data.agentCliMaxChars} 字符` : ""}${lineCount(fullCli) > PANEL_DISPLAY_MAX_LINES ? ` · 面板显示末尾 ${PANEL_DISPLAY_MAX_LINES} 行` : ""}`
              : "—"}
          </p>
          <pre
            ref={cliOutRef}
            className="mt-2 min-h-0 flex-1 max-h-[min(52vh,28rem)] overflow-auto rounded-lg border border-emerald-800/50 bg-zinc-950 p-3 text-xs leading-relaxed text-emerald-100/90"
          >
            {displayCli || "（尚无 agent 输出：开始任务后此处会流式累积 stdout/stderr）"}
          </pre>
        </section>
      </div>

      {showInput && (
        <section
          className={`rounded-xl p-4 ${
            waitingForInput
              ? "border border-amber-700/60 bg-amber-950/30"
              : "border border-zinc-800 bg-zinc-900/40"
          }`}
        >
          <h2 className="text-sm font-semibold text-zinc-200">
            {waitingForInput ? "⚠️ Agent 正在等待你的输入" : "💬 向 Agent 发送消息"}
          </h2>
          <p
            className={`mt-1.5 text-xs leading-relaxed ${
              waitingForInput ? "text-amber-200/90" : "text-zinc-500"
            }`}
          >
            {waitingForInput
              ? "Agent 已停止输出超过 10 秒，很可能在等待你的回复。请在下方输入后点击「发送」继续流程。"
              : "Agent 运行中，你可以随时在此处发送消息。"}
          </p>
          <div className="mt-2 flex gap-2 items-end">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void sendInput();
                }
              }}
              rows={2}
              placeholder="输入你的回复（例如：请继续实现任务 3）…"
              className="min-h-[3rem] max-h-32 flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={sending || !inputText.trim()}
              onClick={() => void sendInput()}
              className="shrink-0 self-end rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "发送中…" : "发送"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">Ctrl+Enter 快捷发送</p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-400">运行日志</h2>
          <button
            type="button"
            disabled={!fullRunLog.trim()}
            onClick={() => void copyFull("log", fullRunLog)}
            className="shrink-0 rounded-md border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copiedKey === "log" ? "已复制" : "复制全文"}
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {fullRunLog.trim() && lineCount(fullRunLog) > PANEL_DISPLAY_MAX_LINES
            ? `共 ${lineCount(fullRunLog)} 行，面板仅显示末尾 ${PANEL_DISPLAY_MAX_LINES} 行；复制全文为完整内容。`
            : fullRunLog.trim()
              ? `共 ${lineCount(fullRunLog)} 行`
              : ""}
        </p>
        <pre className="mt-2 max-h-64 overflow-auto text-xs leading-relaxed text-zinc-500">
          {displayRunLog.trim() ? displayRunLog : "（无）"}
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

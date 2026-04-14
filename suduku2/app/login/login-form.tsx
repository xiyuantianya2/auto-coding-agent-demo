"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const { login, register } = useSudoku2Auth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const baseId = useId();
  const usernameId = `${baseId}-username`;
  const passwordId = `${baseId}-password`;
  const nicknameId = `${baseId}-nickname`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await login(username, password);
        if (!r.ok) {
          setMessage({ kind: "err", text: r.message });
          return;
        }
        setMessage({ kind: "ok", text: "登录成功。" });
        router.push("/");
        return;
      }
      const r = await register(username, password, nickname.trim() || undefined);
      if (!r.ok) {
        setMessage({ kind: "err", text: r.message });
        return;
      }
      setMessage({ kind: "ok", text: "注册成功，已自动登录。" });
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl">
      <div className="flex gap-2 rounded-lg bg-zinc-950/80 p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-emerald-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => {
            setMode("login");
            setMessage(null);
          }}
          data-testid="auth-tab-login"
        >
          登录
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === "register"
              ? "bg-emerald-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => {
            setMode("register");
            setMessage(null);
          }}
          data-testid="auth-tab-register"
        >
          注册
        </button>
      </div>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div>
          <label htmlFor={usernameId} className="block text-sm font-medium text-zinc-300">
            用户名
          </label>
          <input
            id={usernameId}
            name="username"
            autoComplete="username"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/0 transition focus:border-emerald-500/60 focus:ring-2"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            required
            data-testid="auth-username"
          />
        </div>
        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium text-zinc-300">
            密码（不少于 6 位）
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/0 transition focus:border-emerald-500/60 focus:ring-2"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={6}
            data-testid="auth-password"
          />
        </div>
        {mode === "register" ? (
          <div>
            <label htmlFor={nicknameId} className="block text-sm font-medium text-zinc-300">
              昵称（可选）
            </label>
            <input
              id={nicknameId}
              name="nickname"
              autoComplete="nickname"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/0 transition focus:border-emerald-500/60 focus:ring-2"
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              data-testid="auth-nickname"
            />
          </div>
        ) : null}

        <p
          role="status"
          data-testid="auth-feedback"
          data-auth-status={message?.kind ?? "empty"}
          className={
            message
              ? message.kind === "ok"
                ? "text-sm text-emerald-400"
                : "text-sm text-rose-400"
              : "text-sm text-transparent"
          }
        >
          {message?.text ?? " "}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="auth-submit"
        >
          {busy ? "提交中…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 underline-offset-4 hover:underline">
          返回首页
        </Link>
      </p>
    </div>
  );
}

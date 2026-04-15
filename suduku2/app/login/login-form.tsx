"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent, type JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";

export function LoginForm(): JSX.Element {
  const searchParams = useSearchParams();
  const mode: "login" | "register" =
    searchParams.get("mode") === "register" ? "register" : "login";

  const router = useRouter();
  const { login, register } = useSudoku2Auth();
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

    const u = username.trim();
    if (!u) {
      setMessage({ kind: "err", text: "请输入用户名。" });
      return;
    }
    if (password.length < 6) {
      setMessage({ kind: "err", text: "密码长度须不少于 6 位。" });
      return;
    }

    /** 以地址栏为准：客户端路由更新 `useSearchParams` 可能略晚于导航，避免误走登录/注册分支 */
    const submitMode: "login" | "register" =
      typeof globalThis.window !== "undefined" &&
      new URL(globalThis.window.location.href).searchParams.get("mode") === "register"
        ? "register"
        : "login";

    setBusy(true);
    try {
      if (submitMode === "login") {
        const r = await login(u, password);
        if (!r.ok) {
          setMessage({ kind: "err", text: r.message });
          return;
        }
        setMessage({ kind: "ok", text: "登录成功。" });
        router.push("/");
        return;
      }
      const r = await register(u, password, nickname.trim() || undefined);
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
    <div className="w-full max-w-md rounded-[var(--s2-r-2xl)] border border-[var(--s2-border)] bg-[var(--s2-card)] p-8 shadow-xl">
      <div className="flex gap-2 rounded-[var(--s2-r-lg)] bg-[var(--s2-card-muted)] p-1">
        <Link
          href="/login"
          scroll={false}
          className={`flex flex-1 touch-manipulation items-center justify-center rounded-[var(--s2-r-md)] px-3 py-2 text-center text-sm font-medium transition ${
            mode === "login"
              ? "bg-[var(--s2-accent)] text-[var(--s2-on-accent)]"
              : "text-[var(--s2-text-muted)] hover:text-[var(--s2-text)]"
          }`}
          data-testid="auth-tab-login"
          onClick={() => setMessage(null)}
        >
          登录
        </Link>
        <Link
          href="/login?mode=register"
          scroll={false}
          className={`flex flex-1 touch-manipulation items-center justify-center rounded-[var(--s2-r-md)] px-3 py-2 text-center text-sm font-medium transition ${
            mode === "register"
              ? "bg-[var(--s2-accent)] text-[var(--s2-on-accent)]"
              : "text-[var(--s2-text-muted)] hover:text-[var(--s2-text)]"
          }`}
          data-testid="auth-tab-register"
          onClick={() => setMessage(null)}
        >
          注册
        </Link>
      </div>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor={usernameId} className="block text-sm font-medium text-[var(--s2-text-muted)]">
            用户名
          </label>
          <input
            id={usernameId}
            name="username"
            autoComplete="username"
            className="mt-2 w-full rounded-[var(--s2-r-lg)] border border-[var(--s2-input-border)] bg-[var(--s2-input-bg)] px-3 py-2 text-sm text-[var(--s2-text)] outline-none transition focus:border-[var(--s2-focus-border)] focus:ring-2 focus:ring-[var(--s2-focus-ring)]"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            data-testid="auth-username"
          />
        </div>
        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium text-[var(--s2-text-muted)]">
            密码（不少于 6 位）
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-2 w-full rounded-[var(--s2-r-lg)] border border-[var(--s2-input-border)] bg-[var(--s2-input-bg)] px-3 py-2 text-sm text-[var(--s2-text)] outline-none transition focus:border-[var(--s2-focus-border)] focus:ring-2 focus:ring-[var(--s2-focus-ring)]"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            data-testid="auth-password"
          />
        </div>
        {mode === "register" ? (
          <div>
            <label htmlFor={nicknameId} className="block text-sm font-medium text-[var(--s2-text-muted)]">
              昵称（可选）
            </label>
            <input
              id={nicknameId}
              name="nickname"
              autoComplete="nickname"
              className="mt-2 w-full rounded-[var(--s2-r-lg)] border border-[var(--s2-input-border)] bg-[var(--s2-input-bg)] px-3 py-2 text-sm text-[var(--s2-text)] outline-none transition focus:border-[var(--s2-focus-border)] focus:ring-2 focus:ring-[var(--s2-focus-ring)]"
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
                ? "text-sm text-[var(--s2-status-ok)]"
                : "text-sm text-rose-400"
              : "text-sm text-transparent"
          }
        >
          {message?.text ?? " "}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[var(--s2-r-lg)] bg-[var(--s2-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--s2-on-accent)] transition hover:bg-[var(--s2-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="auth-submit"
        >
          {busy ? "提交中…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--s2-text-subtle)]">
        <Link
          href="/"
          className="text-[var(--s2-link)] underline-offset-4 hover:text-[var(--s2-link-hover)] hover:underline"
        >
          返回首页
        </Link>
      </p>
    </div>
  );
}

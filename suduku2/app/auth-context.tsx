"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";

/**
 * 会话令牌存于 `localStorage`（非 `sessionStorage`）：
 * 刷新页面或关闭后再次打开同一浏览器、访问本站时仍保持登录，直至用户主动退出或清除站点数据。
 */
export const SUDOKU2_SESSION_TOKEN_STORAGE_KEY = "suduku2.auth.token";

type ApiErrorWire = { error?: { code?: string; message?: string } };

export type Sudoku2AuthContextValue = {
  /** 已从存储恢复完成，避免首屏闪烁 */
  ready: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  register: (
    username: string,
    password: string,
    nickname?: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
};

const Sudoku2AuthContext = createContext<Sudoku2AuthContextValue | null>(null);

function mapAuthErrorToZh(
  wire: ApiErrorWire | undefined,
  httpStatus: number,
  phase: "register" | "login",
): string {
  if (httpStatus === 0) {
    return "网络连接失败，请检查网络后重试。";
  }
  const code = wire?.error?.code;
  if (code === "USERNAME_CONFLICT") {
    return "该用户名已被注册，请尝试其他用户名。";
  }
  if (code === "INVALID_PASSWORD") {
    return "密码长度须不少于 6 位。";
  }
  if (code === "INVALID_USERNAME") {
    return "请输入有效的用户名。";
  }
  if (phase === "login" && (code === "WRONG_PASSWORD" || code === "UNKNOWN_USER")) {
    return "用户名或密码不正确。";
  }
  if (httpStatus >= 500) {
    return "服务器暂时不可用，请稍后再试。";
  }
  return wire?.error?.message?.trim()
    ? `请求失败（${wire.error?.code ?? httpStatus}）：${wire.error.message}`
    : "请求失败，请稍后重试。";
}

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; wire?: ApiErrorWire; networkError: boolean }
> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = {};
    if (text.trim()) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return {
          ok: false,
          status: res.status,
          networkError: false,
        };
      }
    }
    const data = parsed as T | ApiErrorWire;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        wire: data as ApiErrorWire,
        networkError: false,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, networkError: true };
  }
}

export function AuthProvider(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  const apiBase = useSudoku2ApiBase();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = globalThis.localStorage?.getItem(SUDOKU2_SESSION_TOKEN_STORAGE_KEY);
      if (t && t.length > 0) {
        setToken(t);
      }
    } finally {
      setReady(true);
    }
  }, []);

  const persistToken = useCallback((t: string | null) => {
    setToken(t);
    try {
      if (t) {
        globalThis.localStorage?.setItem(SUDOKU2_SESSION_TOKEN_STORAGE_KEY, t);
      } else {
        globalThis.localStorage?.removeItem(SUDOKU2_SESSION_TOKEN_STORAGE_KEY);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const url = joinSudoku2ApiPath(apiBase, "/api/auth/login");
      const res = await postJson<{ token: string }>(url, { username, password });
      if (!res.ok) {
        const msg = mapAuthErrorToZh(res.wire, res.status, "login");
        return { ok: false as const, message: msg };
      }
      const t = res.data.token;
      if (typeof t !== "string" || t.length === 0) {
        return { ok: false as const, message: "登录响应异常，请稍后重试。" };
      }
      persistToken(t);
      return { ok: true as const };
    },
    [apiBase, persistToken],
  );

  const register = useCallback(
    async (username: string, password: string, nickname?: string) => {
      const regUrl = joinSudoku2ApiPath(apiBase, "/api/auth/register");
      const reg = await postJson<{ userId: string }>(regUrl, {
        username,
        password,
        ...(nickname !== undefined && nickname.trim() !== ""
          ? { nickname: nickname.trim() }
          : {}),
      });
      if (!reg.ok) {
        const msg = mapAuthErrorToZh(reg.wire, reg.status, "register");
        return { ok: false as const, message: msg };
      }
      const loginRes = await login(username, password);
      if (!loginRes.ok) {
        return {
          ok: false as const,
          message: `注册成功，但自动登录失败：${loginRes.message}请尝试在下方使用「登录」。`,
        };
      }
      return { ok: true as const };
    },
    [apiBase, login],
  );

  const logout = useCallback(() => {
    persistToken(null);
  }, [persistToken]);

  const value = useMemo<Sudoku2AuthContextValue>(
    () => ({
      ready,
      token,
      login,
      register,
      logout,
    }),
    [ready, token, login, register, logout],
  );

  return (
    <Sudoku2AuthContext.Provider value={value}>{children}</Sudoku2AuthContext.Provider>
  );
}

export function useSudoku2Auth(): Sudoku2AuthContextValue {
  const v = useContext(Sudoku2AuthContext);
  if (!v) {
    throw new Error("useSudoku2Auth 必须在 AuthProvider 内使用");
  }
  return v;
}

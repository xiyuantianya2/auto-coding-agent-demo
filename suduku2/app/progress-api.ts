import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import type { DifficultyTier, EndlessGlobalState, UserProgress } from "@/server/types";

export type ProgressPayload = UserProgress & { global: EndlessGlobalState };

export type ProgressApiError = {
  status: number;
  message: string;
};

function summarizeHttpError(status: number, bodyText: string): string {
  if (status === 401) {
    return "登录已失效，请重新登录。";
  }
  if (status === 0) {
    return "网络连接失败，请检查网络后重试。";
  }
  const trimmed = bodyText.trim();
  if (trimmed.length === 0) {
    return `请求失败（HTTP ${status}）。`;
  }
  try {
    const w = JSON.parse(trimmed) as { error?: { message?: string } };
    const m = w?.error?.message;
    if (typeof m === "string" && m.length > 0) {
      return m;
    }
  } catch {
    /* ignore */
  }
  return `请求失败（HTTP ${status}）。`;
}

export async function fetchProgress(
  apiBaseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<ProgressPayload> {
  const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress");
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(summarizeHttpError(res.status, text));
  }
  return JSON.parse(text || "{}") as ProgressPayload;
}

export async function patchProgress(
  apiBaseUrl: string,
  token: string,
  patch: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress");
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(patch),
    signal,
  });
  const text = await res.text();
  if (!res.ok && res.status !== 204) {
    throw new Error(summarizeHttpError(res.status, text));
  }
}

export function isDifficultyTier(x: string): x is DifficultyTier {
  return x === "entry" || x === "normal" || x === "hard" || x === "expert";
}

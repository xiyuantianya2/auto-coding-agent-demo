import { joinSudoku2ApiPath } from "@/app/sudoku2-api";

import { summarizeProgressApiError } from "@/app/progress-import-errors";

export async function fetchProgressExportJson(
  apiBaseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress/export");
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(summarizeProgressApiError(res.status, text));
  }
  return text;
}

export async function postProgressImportJson(
  apiBaseUrl: string,
  token: string,
  json: string,
  signal?: AbortSignal,
): Promise<void> {
  const url = joinSudoku2ApiPath(apiBaseUrl, "/api/progress/import");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ json }),
    signal,
  });
  const text = await res.text();
  if (!res.ok && res.status !== 204) {
    throw new Error(summarizeProgressApiError(res.status, text));
  }
}

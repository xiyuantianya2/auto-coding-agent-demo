"use client";

import {
  createContext,
  useContext,
  type JSX,
  type ReactNode,
} from "react";

const Sudoku2ApiBaseContext = createContext<string>("");

/**
 * 读取根布局注入的「数独2」HTTP API 基址（不含末尾 `/`）。
 * 与 {@link joinSudoku2ApiPath} 搭配使用，避免在组件中散落拼接逻辑。
 */
export function useSudoku2ApiBase(): string {
  return useContext(Sudoku2ApiBaseContext);
}

/**
 * 应用级 Provider：注入 `apiBaseUrl`，供后续任务中的 `fetch`/轻量客户端统一拼接路径。
 *
 * @see `NEXT_PUBLIC_SUDUKU2_API_BASE` — 在根 `layout` 中读取并传入；默认 `""` 表示与前端同源（由 Next `app/api` 托管时可用相对路径）。
 */
export function Sudoku2AppProviders(props: {
  children: ReactNode;
  apiBaseUrl: string;
}): JSX.Element {
  const { children, apiBaseUrl } = props;
  return (
    <Sudoku2ApiBaseContext.Provider value={apiBaseUrl}>
      {children}
    </Sudoku2ApiBaseContext.Provider>
  );
}

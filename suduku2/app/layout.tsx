import type { Metadata } from "next";
import { Sudoku2AppProviders } from "@/app/sudoku2-app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "数独2 | Suduku2",
  description: "局域网数独：教学、无尽关卡与笔记提示。",
};

/**
 * API 基址：`NEXT_PUBLIC_SUDUKU2_API_BASE`（公开给浏览器，故需 `NEXT_PUBLIC_` 前缀）。
 * 默认 `""` = 与站点同源，适用于 Next `app/api` 路由；内网跨主机见 `sudoku2-api.ts` 文档。
 */
const sudoku2ApiBaseUrl =
  process.env.NEXT_PUBLIC_SUDUKU2_API_BASE ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 font-sans text-zinc-100">
        <Sudoku2AppProviders apiBaseUrl={sudoku2ApiBaseUrl}>
          <main
            id="sudoku2-main"
            role="main"
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </main>
        </Sudoku2AppProviders>
      </body>
    </html>
  );
}

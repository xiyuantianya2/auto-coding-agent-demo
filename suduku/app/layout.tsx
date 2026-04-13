import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数独 | Suduku",
  description:
    "浏览器数独：核心规则与存档模型。Sudoku puzzle with teaching and endless modes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 font-sans text-zinc-100">
        {children}
      </body>
    </html>
  );
}
